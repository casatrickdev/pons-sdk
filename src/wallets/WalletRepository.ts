import { optionalAddress, requireAddress } from "../validation/address.js";
import type { PonsDatabase } from "../storage/Database.js";
import { normalizeWalletActivity, walletActivityIdentity } from "./WalletActivity.js";
import type {
  WalletActivity,
  WalletActivityInput,
  WalletActivityQuery,
  WatchedWallet,
} from "./types.js";

interface ActivityRow {
  wallet: string;
  token_address: string;
  pool_address: string | null;
  side: "buy" | "sell";
  amount_token: string | null;
  amount_quote: string | null;
  block_number: string;
  transaction_hash: string;
  log_index: string;
  timestamp: string | null;
  source: "pons";
}

interface WatchedRow {
  address: string;
  label: string | null;
  enabled: number;
}

function optionalBigInt(value: string | null): bigint | undefined {
  if (value === null) {
    return undefined;
  }
  return BigInt(value);
}

function toActivity(row: ActivityRow): WalletActivity {
  return normalizeWalletActivity({
    wallet: row.wallet,
    token: row.token_address,
    pool: row.pool_address ?? undefined,
    side: row.side,
    amountToken: optionalBigInt(row.amount_token),
    amountQuote: optionalBigInt(row.amount_quote),
    blockNumber: BigInt(row.block_number),
    transactionHash: row.transaction_hash,
    logIndex: BigInt(row.log_index),
    timestamp: row.timestamp ?? undefined,
    source: row.source,
  });
}

export class WalletRepository {
  constructor(private readonly database: PonsDatabase) {}

  insertActivity(
    activity: WalletActivityInput,
    createdAt: string = new Date().toISOString(),
  ): number {
    const normalized = normalizeWalletActivity(activity);
    const result = this.database.sqlite
      .prepare(
        `
        INSERT OR IGNORE INTO wallet_activity (
          wallet,
          token_address,
          pool_address,
          side,
          amount_token,
          amount_quote,
          block_number,
          transaction_hash,
          log_index,
          timestamp,
          source,
          created_at
        ) VALUES (
          @wallet,
          @token_address,
          @pool_address,
          @side,
          @amount_token,
          @amount_quote,
          @block_number,
          @transaction_hash,
          @log_index,
          @timestamp,
          @source,
          @created_at
        )
        `,
      )
      .run({
        wallet: normalized.wallet,
        token_address: normalized.token,
        pool_address: normalized.pool ?? null,
        side: normalized.side,
        amount_token: normalized.amountToken?.toString() ?? null,
        amount_quote: normalized.amountQuote?.toString() ?? null,
        block_number: normalized.blockNumber.toString(),
        transaction_hash: normalized.transactionHash.toLowerCase(),
        log_index: normalized.logIndex.toString(),
        timestamp: normalized.timestamp ?? null,
        source: normalized.source,
        created_at: createdAt,
      });

    return result.changes;
  }

  getActivity(query: WalletActivityQuery = {}): WalletActivity[] {
    const { sql, params } = this.buildFilter(query);
    const limitSql = query.limit === undefined ? "" : " LIMIT @limit";
    const rows = this.database.sqlite
      .prepare(
        `
        SELECT * FROM wallet_activity
        ${sql}
        ORDER BY CAST(block_number AS INTEGER) ASC, CAST(log_index AS INTEGER) ASC
        ${limitSql}
        `,
      )
      .all(params) as ActivityRow[];

    return rows.map(toActivity);
  }

  getRecentActivity(wallet: string, limit: number): WalletActivity[] {
    const rows = this.database.sqlite
      .prepare(
        `
        SELECT * FROM wallet_activity
        WHERE wallet = ?
        ORDER BY CAST(block_number AS INTEGER) DESC, CAST(log_index AS INTEGER) DESC
        LIMIT ?
        `,
      )
      .all(requireAddress(wallet, "wallet"), limit) as ActivityRow[];

    return rows.map(toActivity);
  }

  getActivityByToken(
    token: string,
    options: Omit<WalletActivityQuery, "token"> = {},
  ): WalletActivity[] {
    return this.getActivity({ ...options, token });
  }

  getLatestActivity(limit: number): WalletActivity[] {
    const rows = this.database.sqlite
      .prepare(
        `
        SELECT * FROM wallet_activity
        ORDER BY CAST(block_number AS INTEGER) DESC, CAST(log_index AS INTEGER) DESC
        LIMIT ?
        `,
      )
      .all(limit) as ActivityRow[];

    return rows.map(toActivity);
  }

  getWallets(): string[] {
    const rows = this.database.sqlite
      .prepare(
        `
        SELECT DISTINCT wallet FROM wallet_activity
        ORDER BY wallet ASC
        `,
      )
      .all() as { wallet: string }[];
    return rows.map((row) => row.wallet);
  }

  watchWallet(wallet: string, label?: string, createdAt: string = new Date().toISOString()): void {
    const address = requireAddress(wallet, "wallet");
    this.database.sqlite
      .prepare(
        `
        INSERT INTO watched_wallets (address, label, enabled, created_at)
        VALUES (@address, @label, 1, @created_at)
        ON CONFLICT(address) DO UPDATE SET
          label = COALESCE(excluded.label, watched_wallets.label),
          enabled = 1
        `,
      )
      .run({
        address,
        label: label ?? null,
        created_at: createdAt,
      });
  }

  addWallet(wallet: string, label?: string): void {
    this.watchWallet(wallet, label);
  }

  unwatchWallet(wallet: string): void {
    this.disableWallet(wallet);
  }

  enableWallet(wallet: string): void {
    const address = requireAddress(wallet, "wallet");
    const existing = this.getWallet(address);
    if (existing === undefined) {
      this.watchWallet(address);
      return;
    }
    this.database.sqlite
      .prepare("UPDATE watched_wallets SET enabled = 1 WHERE address = ?")
      .run(address);
  }

  disableWallet(wallet: string): void {
    this.database.sqlite
      .prepare("UPDATE watched_wallets SET enabled = 0 WHERE address = ?")
      .run(requireAddress(wallet, "wallet"));
  }

  removeWallet(wallet: string): void {
    this.database.sqlite
      .prepare("DELETE FROM watched_wallets WHERE address = ?")
      .run(requireAddress(wallet, "wallet"));
  }

  getWallet(wallet: string): WatchedWallet | undefined {
    const row = this.database.sqlite
      .prepare("SELECT address, label, enabled FROM watched_wallets WHERE address = ?")
      .get(requireAddress(wallet, "wallet")) as WatchedRow | undefined;
    if (row === undefined) {
      return undefined;
    }
    return {
      address: requireAddress(row.address, "wallet"),
      label: row.label ?? undefined,
      enabled: row.enabled === 1,
    };
  }

  listWallets(): WatchedWallet[] {
    return this.listWatchedWallets();
  }

  listWatchedWallets(): WatchedWallet[] {
    const rows = this.database.sqlite
      .prepare(
        `
        SELECT address, label, enabled
        FROM watched_wallets
        ORDER BY address ASC
        `,
      )
      .all() as WatchedRow[];

    return rows.map((row) => ({
      address: requireAddress(row.address, "wallet"),
      label: row.label ?? undefined,
      enabled: row.enabled === 1,
    }));
  }

  activityIdentity(activity: WalletActivity): string {
    return walletActivityIdentity(activity);
  }

  private buildFilter(query: WalletActivityQuery): {
    sql: string;
    params: Record<string, string | number>;
  } {
    const clauses: string[] = [];
    const params: Record<string, string | number> = {};

    const wallet = optionalAddress(query.wallet, "wallet");
    if (wallet !== undefined) {
      clauses.push("wallet = @wallet");
      params.wallet = wallet;
    }

    const token = optionalAddress(query.token, "token");
    if (token !== undefined) {
      clauses.push("token_address = @token");
      params.token = token;
    }

    if (query.fromBlock !== undefined) {
      clauses.push("CAST(block_number AS INTEGER) >= CAST(@fromBlock AS INTEGER)");
      params.fromBlock = query.fromBlock.toString();
    }

    if (query.toBlock !== undefined) {
      clauses.push("CAST(block_number AS INTEGER) <= CAST(@toBlock AS INTEGER)");
      params.toBlock = query.toBlock.toString();
    }

    if (query.limit !== undefined) {
      params.limit = query.limit;
    }

    return {
      sql: clauses.length === 0 ? "" : `WHERE ${clauses.join(" AND ")}`,
      params,
    };
  }
}

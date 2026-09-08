import type { PonsVersion } from "../../contracts/addresses.js";
import { isPonsVersion } from "../../contracts/addresses.js";
import { PonsError } from "../../errors/PonsError.js";
import type { PonsLaunch } from "../../types/launch.js";
import { optionalAddress, requireAddress } from "../../validation/address.js";
import type { PonsDatabase } from "../Database.js";
import type { IndexedLaunch, IndexedLaunchQuery } from "../../indexer/types.js";

interface LaunchRow {
  version: string;
  token_address: string;
  deployer: string;
  factory: string;
  dex_factory: string | null;
  pair_token: string | null;
  pool_address: string | null;
  curve: string | null;
  dex_id: string | null;
  launch_config_id: string | null;
  position_id: string | null;
  restrictions_end_block: string | null;
  initial_buy_amount: string | null;
  graduation_threshold: string | null;
  block_number: string;
  transaction_hash: string;
  transaction_index: string | null;
  log_index: string;
  timestamp: string | null;
  created_at: string;
}

interface LaunchInsertRow {
  version: PonsVersion;
  token_address: string;
  deployer: string;
  factory: string;
  dex_factory: string | null;
  pair_token: string | null;
  pool_address: string | null;
  curve: string | null;
  dex_id: string | null;
  launch_config_id: string | null;
  position_id: string | null;
  restrictions_end_block: string | null;
  initial_buy_amount: string | null;
  graduation_threshold: string | null;
  block_number: string;
  transaction_hash: string;
  transaction_index: string;
  log_index: string;
  timestamp: string | null;
  created_at: string;
}

function bigintText(value: bigint): string {
  return value.toString();
}

function toInsertRow(
  launch: PonsLaunch,
  timestamp: bigint | undefined,
  createdAt: string,
): LaunchInsertRow {
  const base = {
    version: launch.version,
    token_address: launch.token,
    deployer: launch.deployer,
    factory: launch.factory,
    pair_token: launch.pairToken,
    launch_config_id: bigintText(launch.launchConfigId),
    block_number: bigintText(launch.blockNumber),
    transaction_hash: launch.transactionHash.toLowerCase(),
    transaction_index: bigintText(launch.transactionIndex),
    log_index: bigintText(launch.logIndex),
    timestamp: timestamp === undefined ? null : bigintText(timestamp),
    created_at: createdAt,
  };

  if (launch.version === "v1") {
    return {
      ...base,
      dex_factory: launch.dexFactory,
      pool_address: launch.pool,
      curve: null,
      dex_id: bigintText(launch.dexId),
      position_id: bigintText(launch.positionId),
      restrictions_end_block: bigintText(launch.restrictionsEndBlock),
      initial_buy_amount: bigintText(launch.initialBuyAmount),
      graduation_threshold: null,
    };
  }

  return {
    ...base,
    dex_factory: null,
    pool_address: null,
    curve: launch.curve,
    dex_id: null,
    position_id: null,
    restrictions_end_block: null,
    initial_buy_amount: null,
    graduation_threshold: bigintText(launch.graduationThreshold),
  };
}

function toIndexedLaunch(row: LaunchRow): IndexedLaunch {
  if (!isPonsVersion(row.version)) {
    throw new PonsError(`Stored launch has an invalid version: ${row.version}`);
  }

  return {
    version: row.version,
    token: row.token_address,
    deployer: row.deployer,
    factory: row.factory,
    dexFactory: row.dex_factory,
    pairToken: row.pair_token,
    pool: row.pool_address,
    curve: row.curve,
    dexId: row.dex_id,
    launchConfigId: row.launch_config_id,
    positionId: row.position_id,
    restrictionsEndBlock: row.restrictions_end_block,
    initialBuyAmount: row.initial_buy_amount,
    graduationThreshold: row.graduation_threshold,
    blockNumber: row.block_number,
    transactionHash: row.transaction_hash,
    transactionIndex: row.transaction_index,
    logIndex: row.log_index,
    timestamp: row.timestamp,
    createdAt: row.created_at,
  };
}

function orderClause(direction: "ASC" | "DESC"): string {
  return `
    CAST(block_number AS INTEGER) ${direction},
    CAST(COALESCE(transaction_index, '0') AS INTEGER) ${direction},
    CAST(log_index AS INTEGER) ${direction}
  `;
}

export class LaunchRepository {
  constructor(private readonly database: PonsDatabase) {}

  insertLaunches(
    launches: readonly PonsLaunch[],
    timestamps: ReadonlyMap<string, bigint>,
    createdAt: string = new Date().toISOString(),
  ): number {
    const stmt = this.database.sqlite.prepare(
      `
      INSERT OR IGNORE INTO launches (
        version,
        token_address,
        deployer,
        factory,
        dex_factory,
        pair_token,
        pool_address,
        curve,
        dex_id,
        launch_config_id,
        position_id,
        restrictions_end_block,
        initial_buy_amount,
        graduation_threshold,
        block_number,
        transaction_hash,
        transaction_index,
        log_index,
        timestamp,
        created_at
      ) VALUES (
        @version,
        @token_address,
        @deployer,
        @factory,
        @dex_factory,
        @pair_token,
        @pool_address,
        @curve,
        @dex_id,
        @launch_config_id,
        @position_id,
        @restrictions_end_block,
        @initial_buy_amount,
        @graduation_threshold,
        @block_number,
        @transaction_hash,
        @transaction_index,
        @log_index,
        @timestamp,
        @created_at
      )
      `,
    );

    let inserted = 0;
    for (const launch of launches) {
      const timestamp = timestamps.get(launch.blockNumber.toString());
      const result = stmt.run(toInsertRow(launch, timestamp, createdAt));
      inserted += result.changes;
    }
    return inserted;
  }

  getLaunch(token: string): IndexedLaunch | undefined {
    const row = this.database.sqlite
      .prepare(
        `
        SELECT * FROM launches
        WHERE token_address = ?
        ORDER BY ${orderClause("ASC")}
        LIMIT 1
        `,
      )
      .get(requireAddress(token, "token")) as LaunchRow | undefined;

    return row === undefined ? undefined : toIndexedLaunch(row);
  }

  getLaunches(query: IndexedLaunchQuery = {}, order: "ASC" | "DESC" = "ASC"): IndexedLaunch[] {
    const { sql, params } = this.buildFilter(query);
    const limitSql = query.limit === undefined ? "" : " LIMIT @limit";
    const rows = this.database.sqlite
      .prepare(
        `
        SELECT * FROM launches
        ${sql}
        ORDER BY ${orderClause(order)}
        ${limitSql}
        `,
      )
      .all(params) as LaunchRow[];

    return rows.map(toIndexedLaunch);
  }

  countLaunches(query: IndexedLaunchQuery = {}): number {
    const { sql, params } = this.buildFilter(query, { includeLimit: false });
    const row = this.database.sqlite
      .prepare(`SELECT COUNT(*) AS count FROM launches ${sql}`)
      .get(params) as { count: number };
    return row.count;
  }

  private buildFilter(
    query: IndexedLaunchQuery,
    options: { includeLimit?: boolean } = {},
  ): { sql: string; params: Record<string, string | number> } {
    const clauses: string[] = [];
    const params: Record<string, string | number> = {};

    if (query.version !== undefined) {
      clauses.push("version = @version");
      params.version = query.version;
    }

    const token = optionalAddress(query.token, "token");
    if (token !== undefined) {
      clauses.push("token_address = @token");
      params.token = token;
    }

    const deployer = optionalAddress(query.deployer, "deployer");
    if (deployer !== undefined) {
      clauses.push("deployer = @deployer");
      params.deployer = deployer;
    }

    const pool = optionalAddress(query.pool, "pool");
    if (pool !== undefined) {
      clauses.push("pool_address = @pool");
      params.pool = pool;
    }

    if (query.fromBlock !== undefined) {
      clauses.push("CAST(block_number AS INTEGER) >= CAST(@fromBlock AS INTEGER)");
      params.fromBlock = query.fromBlock.toString();
    }

    if (query.toBlock !== undefined) {
      clauses.push("CAST(block_number AS INTEGER) <= CAST(@toBlock AS INTEGER)");
      params.toBlock = query.toBlock.toString();
    }

    if (options.includeLimit !== false && query.limit !== undefined) {
      params.limit = query.limit;
    }

    const sql = clauses.length === 0 ? "" : `WHERE ${clauses.join(" AND ")}`;
    return { sql, params };
  }
}

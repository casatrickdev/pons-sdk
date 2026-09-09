import { afterEach, describe, expect, it } from "vitest";
import { PONS_REFERENCE } from "../../src/contracts/addresses.js";
import { PonsDatabase } from "../../src/storage/Database.js";
import { WalletRepository } from "../../src/wallets/WalletRepository.js";
import { buildWalletState } from "../../src/wallets/WalletState.js";
import {
  SYNTHETIC_WATCHED_WALLET,
  syntheticBuyActivity,
  syntheticSellActivity,
} from "../fixtures/walletActivity.synthetic.js";

describe("wallet research storage", () => {
  const databases: PonsDatabase[] = [];

  afterEach(() => {
    for (const database of databases) {
      database.close();
    }
    databases.length = 0;
  });

  function repo(): WalletRepository {
    const database = new PonsDatabase(":memory:");
    databases.push(database);
    return new WalletRepository(database);
  }

  it("persists synthetic wallet activity without duplicates", () => {
    const wallets = repo();
    expect(wallets.insertActivity(syntheticBuyActivity)).toBe(1);
    expect(wallets.insertActivity(syntheticBuyActivity)).toBe(0);
    expect(wallets.getActivity({ wallet: SYNTHETIC_WATCHED_WALLET })).toHaveLength(1);
    expect(wallets.getWallets()).toEqual([SYNTHETIC_WATCHED_WALLET]);
  });

  it("filters activity by token and block range", () => {
    const wallets = repo();
    wallets.insertActivity(syntheticBuyActivity);
    wallets.insertActivity(syntheticSellActivity);

    expect(
      wallets.getActivity({ token: PONS_REFERENCE.token, fromBlock: 8_963_155n }),
    ).toHaveLength(1);
    expect(wallets.getRecentActivity(SYNTHETIC_WATCHED_WALLET, 1)[0]?.side).toBe("sell");
  });

  it("watches and unwatches wallets", () => {
    const wallets = repo();
    wallets.watchWallet(SYNTHETIC_WATCHED_WALLET, "legacy deployer");
    expect(wallets.listWatchedWallets()).toEqual([
      {
        address: SYNTHETIC_WATCHED_WALLET,
        label: "legacy deployer",
        enabled: true,
      },
    ]);
    wallets.unwatchWallet(SYNTHETIC_WATCHED_WALLET);
    expect(wallets.listWatchedWallets()[0]?.enabled).toBe(false);
  });

  it("builds wallet state quantities without inventing pnl", () => {
    const state = buildWalletState(SYNTHETIC_WATCHED_WALLET, [
      syntheticBuyActivity,
      syntheticSellActivity,
    ]);

    expect(state.positions).toHaveLength(1);
    expect(state.positions[0]?.quantity).toBe(750_000_000_000_000_000n);
    expect(state.positions[0]?.averageEntry).toBeUndefined();
    expect(state.positions[0]?.realizedPnl).toBeUndefined();
    expect(state.recentActivity).toHaveLength(2);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { PONS_REFERENCE } from "../../src/contracts/addresses.js";
import { PonsConfigError } from "../../src/errors/PonsError.js";
import { PonsDatabase } from "../../src/storage/Database.js";
import { WalletActivityRepository, WalletRepository } from "../../src/wallets/WalletRepository.js";
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

  it("adds, enables, disables, and removes a watched wallet", () => {
    const wallets = repo();
    wallets.addWallet(SYNTHETIC_WATCHED_WALLET, "alpha");
    wallets.addWallet(SYNTHETIC_WATCHED_WALLET, "alpha");
    expect(wallets.listWallets()).toHaveLength(1);
    expect(wallets.getWallet(SYNTHETIC_WATCHED_WALLET)?.enabled).toBe(true);

    wallets.disableWallet(SYNTHETIC_WATCHED_WALLET);
    expect(wallets.getWallet(SYNTHETIC_WATCHED_WALLET)?.enabled).toBe(false);

    wallets.enableWallet(SYNTHETIC_WATCHED_WALLET);
    expect(wallets.getWallet(SYNTHETIC_WATCHED_WALLET)?.enabled).toBe(true);

    wallets.removeWallet(SYNTHETIC_WATCHED_WALLET);
    expect(wallets.getWallet(SYNTHETIC_WATCHED_WALLET)).toBeUndefined();
    expect(wallets.listWallets()).toHaveLength(0);
  });

  it("rejects an invalid watchlist address", () => {
    const wallets = repo();
    expect(() => wallets.addWallet("0x123")).toThrow(PonsConfigError);
    expect(() => wallets.addWallet("not-an-address")).toThrow(/Invalid address for wallet/);
  });

  it("queries activity by wallet through WalletActivityRepository", () => {
    const database = new PonsDatabase(":memory:");
    databases.push(database);
    const activity = new WalletActivityRepository(database);
    activity.insertActivity(syntheticBuyActivity);
    activity.insertActivity(syntheticSellActivity);

    expect(activity.getActivity(SYNTHETIC_WATCHED_WALLET)).toHaveLength(2);
    expect(activity.getActivity(SYNTHETIC_WATCHED_WALLET, { limit: 1 })).toHaveLength(1);
    expect(activity.getRecentActivity(SYNTHETIC_WATCHED_WALLET)[0]?.side).toBe("sell");
  });

  it("returns latest synthetic activity in descending block order", () => {
    const wallets = repo();
    wallets.insertActivity(syntheticBuyActivity);
    wallets.insertActivity(syntheticSellActivity);
    expect(wallets.getLatestActivity(1)[0]?.side).toBe("sell");
    expect(wallets.getActivityByToken(PONS_REFERENCE.token)).toHaveLength(2);
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

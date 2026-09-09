import type { Address } from "viem";
import { requireAddress } from "../validation/address.js";
import type { WalletActivity, WalletPosition, WalletState } from "./types.js";

function compareActivity(a: WalletActivity, b: WalletActivity): number {
  if (a.blockNumber !== b.blockNumber) {
    return a.blockNumber < b.blockNumber ? -1 : 1;
  }
  if (a.logIndex !== b.logIndex) {
    return a.logIndex < b.logIndex ? -1 : 1;
  }
  return 0;
}

/**
 * Builds a research wallet snapshot from normalized activity.
 * Quantity is a running buy/sell token sum when amounts exist.
 * averageEntry and realizedPnl stay unset — swap indexing is not available.
 */
export function buildWalletState(
  wallet: string,
  activity: readonly WalletActivity[],
  updatedAt: string = new Date().toISOString(),
): WalletState {
  const address = requireAddress(wallet, "wallet");
  const recentActivity = [...activity]
    .filter((item) => item.wallet.toLowerCase() === address.toLowerCase())
    .sort(compareActivity);

  const quantities = new Map<Address, bigint>();

  for (const item of recentActivity) {
    if (item.amountToken === undefined) {
      continue;
    }
    const current = quantities.get(item.token) ?? 0n;
    const next = item.side === "buy" ? current + item.amountToken : current - item.amountToken;
    quantities.set(item.token, next < 0n ? 0n : next);
  }

  const positions: WalletPosition[] = [...quantities.entries()]
    .filter(([, quantity]) => quantity > 0n)
    .map(([token, quantity]) => ({
      token,
      quantity,
      updatedAt,
    }));

  return {
    wallet: address,
    positions,
    recentActivity,
    updatedAt,
  };
}

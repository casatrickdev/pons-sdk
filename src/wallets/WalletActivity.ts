import { type Hash, isHash } from "viem";
import { PonsConfigError } from "../errors/PonsError.js";
import { optionalAddress, requireAddress } from "../validation/address.js";
import type { TradeSide, WalletActivity, WalletActivityInput } from "./types.js";

export function isTradeSide(value: string): value is TradeSide {
  return value === "buy" || value === "sell";
}

export function walletActivityIdentity(
  activity: Pick<WalletActivity, "transactionHash" | "logIndex">,
): string {
  return `${activity.transactionHash.toLowerCase()}:${activity.logIndex.toString()}`;
}

export function normalizeWalletActivity(activity: WalletActivityInput): WalletActivity {
  if (activity.source !== "pons") {
    throw new PonsConfigError(`Unsupported wallet activity source: ${String(activity.source)}`, {
      field: "source",
    });
  }

  if (!isTradeSide(activity.side)) {
    throw new PonsConfigError(`Unsupported trade side: ${String(activity.side)}`, {
      field: "side",
    });
  }

  if (activity.blockNumber < 0n) {
    throw new PonsConfigError("blockNumber must be greater than or equal to 0", {
      field: "blockNumber",
    });
  }

  if (activity.logIndex < 0n) {
    throw new PonsConfigError("logIndex must be greater than or equal to 0", { field: "logIndex" });
  }

  if (!isHash(activity.transactionHash)) {
    throw new PonsConfigError("transactionHash must be a 32-byte hash", {
      field: "transactionHash",
    });
  }

  if (activity.amountToken !== undefined && activity.amountToken < 0n) {
    throw new PonsConfigError("amountToken must be greater than or equal to 0", {
      field: "amountToken",
    });
  }

  if (activity.amountQuote !== undefined && activity.amountQuote < 0n) {
    throw new PonsConfigError("amountQuote must be greater than or equal to 0", {
      field: "amountQuote",
    });
  }

  return {
    wallet: requireAddress(activity.wallet, "wallet"),
    token: requireAddress(activity.token, "token"),
    pool: optionalAddress(activity.pool, "pool"),
    side: activity.side,
    amountToken: activity.amountToken,
    amountQuote: activity.amountQuote,
    blockNumber: activity.blockNumber,
    transactionHash: activity.transactionHash.toLowerCase() as Hash,
    logIndex: activity.logIndex,
    timestamp: activity.timestamp,
    source: "pons",
  };
}

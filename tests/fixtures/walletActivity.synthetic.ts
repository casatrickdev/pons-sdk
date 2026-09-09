import type { Address, Hash } from "viem";
import { PONS_REFERENCE } from "../../src/contracts/addresses.js";
import type { WalletActivity } from "../../src/wallets/types.js";

/**
 * Synthetic domain fixture.
 * Not a decoded Pons swap log. Swap indexing is not implemented yet.
 * Addresses are real Pons/Robinhood Chain values so later live wiring stays honest.
 */
export const SYNTHETIC_WATCHED_WALLET = "0xB9F5f4Ea1AF1F5d3678470eb98e8FBdcadEb24b0" as Address;

export const SYNTHETIC_BUY_TX =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Hash;

export const SYNTHETIC_SELL_TX =
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Hash;

export const syntheticBuyActivity: WalletActivity = {
  wallet: SYNTHETIC_WATCHED_WALLET,
  token: PONS_REFERENCE.token,
  pool: PONS_REFERENCE.pool,
  side: "buy",
  amountToken: 1_000_000_000_000_000_000n,
  amountQuote: 100_000_000_000_000_000n,
  blockNumber: 8_963_150n,
  transactionHash: SYNTHETIC_BUY_TX,
  logIndex: 1n,
  timestamp: "1700000000",
  source: "pons",
};

export const syntheticSellActivity: WalletActivity = {
  ...syntheticBuyActivity,
  side: "sell",
  amountToken: 250_000_000_000_000_000n,
  amountQuote: 20_000_000_000_000_000n,
  transactionHash: SYNTHETIC_SELL_TX,
  logIndex: 2n,
  blockNumber: 8_963_160n,
  timestamp: "1700000120",
};

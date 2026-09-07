import type { Address, Hash, Hex } from "viem";

/**
 * RPC-compatible log shape accepted by `decodeTokenLaunched`.
 * Numeric fields may be hex strings, matching `eth_getLogs` / receipts.
 */
export interface TokenLaunchedLogInput {
  address: string;
  topics: readonly string[];
  data: string;
  blockNumber?: bigint | number | string | null;
  transactionHash?: string | null;
  transactionIndex?: bigint | number | string | null;
  logIndex?: bigint | number | string | null;
}

export interface NormalizedTokenLaunchedLog {
  address: Address;
  topics: readonly Hex[];
  data: Hex;
  blockNumber: bigint;
  transactionHash: Hash;
  transactionIndex: bigint;
  logIndex: bigint;
}

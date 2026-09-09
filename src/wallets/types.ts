import type { Address, Hash } from "viem";

export type TradeSide = "buy" | "sell";

export type WalletActivitySource = "pons";

/**
 * Normalized wallet activity for copy-trading research.
 *
 * This is a domain model, not a decoded Pons swap event. The SDK does not yet
 * index Pons swap logs. Callers supply activity once that path exists.
 */
export interface WalletActivityInput {
  wallet: string;
  token: string;
  pool?: string;
  side: string;
  amountToken?: bigint;
  amountQuote?: bigint;
  blockNumber: bigint;
  transactionHash: string;
  logIndex: bigint;
  timestamp?: string;
  source: string;
}

export interface WalletActivity {
  wallet: Address;
  token: Address;
  pool?: Address;
  side: TradeSide;
  amountToken?: bigint;
  amountQuote?: bigint;
  blockNumber: bigint;
  transactionHash: Hash;
  logIndex: bigint;
  timestamp?: string;
  source: WalletActivitySource;
}

export interface WalletPosition {
  token: Address;
  quantity: bigint;
  averageEntry?: bigint;
  realizedPnl?: bigint;
  updatedAt?: string;
}

export interface WalletState {
  wallet: Address;
  positions: WalletPosition[];
  recentActivity: WalletActivity[];
  updatedAt: string;
}

export interface WatchedWallet {
  address: Address;
  label?: string;
  enabled: boolean;
}

export interface WalletActivityQuery {
  wallet?: string;
  token?: string;
  fromBlock?: bigint;
  toBlock?: bigint;
  limit?: number;
}

import type { Address, Hash } from "viem";
import type { TradeSide, WalletActivity, WalletState } from "../wallets/types.js";

export type CopyTradeMode = "research" | "live";

export interface TradeCandidate {
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
}

export interface LayerDecision {
  approved: boolean;
  reasons: string[];
}

export type FilterDecision = LayerDecision;
export type RiskDecision = LayerDecision;

export interface CopyTradeFilterConfig {
  allowedWallets?: readonly string[];
  allowedTokens?: readonly string[];
  excludedWallets?: readonly string[];
  excludedTokens?: readonly string[];
  minTradeSize?: bigint;
  maxTradeSize?: bigint;
  maxSignalAgeSeconds?: number;
}

export interface CopyTradePolicy {
  maxPositionSize?: bigint;
  maxTokenExposure?: bigint;
  maxWalletExposure?: bigint;
  maxOpenPositions?: number;
  maxConcurrentPositions?: number;
  minTradeSize?: bigint;
  maxTradeSize?: bigint;
  allowedWallets?: readonly string[];
  allowedTokens?: readonly string[];
  excludedWallets?: readonly string[];
  excludedTokens?: readonly string[];
  maxSignalAgeSeconds?: number;
}

export type CopyTradeSignalStatus = "candidate" | "approved" | "rejected";

export interface CopyTradeSignal {
  id: string;
  sourceWallet: Address;
  token: Address;
  pool?: Address;
  side: TradeSide;
  sourceTransaction: Hash;
  sourceLogIndex: bigint;
  blockNumber: bigint;
  createdAt: string;
  status: CopyTradeSignalStatus;
  detectionReasons: string[];
  filterReasons: string[];
  riskReasons: string[];
}

export interface TradeDetection {
  supported: boolean;
  reasons: string[];
  candidate?: TradeCandidate;
  activity?: WalletActivity;
}

export interface RiskContext {
  walletState?: WalletState;
  nowSeconds?: bigint;
}

export function tradeSize(
  activity: Pick<TradeCandidate, "amountQuote" | "amountToken">,
): bigint | undefined {
  return activity.amountQuote ?? activity.amountToken;
}

export function copyTradeSignalId(transactionHash: string, logIndex: bigint | string): string {
  return `${transactionHash.toLowerCase()}:${BigInt(logIndex).toString()}`;
}

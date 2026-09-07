import type { Address, Hash } from "viem";
import type { PonsVersion } from "../contracts/addresses.js";

export interface PonsLaunchLogMeta {
  blockNumber: bigint;
  transactionHash: Hash;
  transactionIndex: bigint;
  logIndex: bigint;
}

export interface PonsV1Launch extends PonsLaunchLogMeta {
  version: "v1";
  factory: Address;
  token: Address;
  deployer: Address;
  dexFactory: Address;
  pairToken: Address;
  pool: Address;
  dexId: bigint;
  launchConfigId: bigint;
  positionId: bigint;
  restrictionsEndBlock: bigint;
  initialBuyAmount: bigint;
}

export interface PonsV2Launch extends PonsLaunchLogMeta {
  version: "v2";
  factory: Address;
  token: Address;
  curve: Address;
  deployer: Address;
  pairToken: Address;
  launchConfigId: bigint;
  graduationThreshold: bigint;
}

export type PonsLaunch = PonsV1Launch | PonsV2Launch;

export interface GetLaunchesParams {
  fromBlock: bigint;
  toBlock?: bigint | "latest";
  chunkSize?: bigint;
  version?: PonsVersion | readonly PonsVersion[];
  token?: string;
  deployer?: string;
  includeLegacy?: boolean;
}

export type GetTokenLaunchedLogsParams = GetLaunchesParams;

export type PonsV2GraduationPhase = 0 | 1 | 2 | 3;

export const PONS_V2_GRADUATION_PHASE = {
  notGraduated: 0,
  swept: 1,
  poolCreated: 2,
  rescued: 3,
} as const;

export const PONS_V2_GRADUATION_PHASE_NAME = {
  0: "notGraduated",
  1: "swept",
  2: "poolCreated",
  3: "rescued",
} as const;

export interface PonsV1LaunchedToken {
  version: "v1";
  factory: Address;
  token: Address;
  deployer: Address;
  pairedToken: Address;
  positionManager: Address;
  positionId: bigint;
  dexId: bigint;
  launchConfigId: bigint;
  restrictionsEndBlock: bigint;
  supply: bigint;
  isToken0: boolean;
  poolFee: number;
  exists: boolean;
  initialBuyAmount: bigint;
}

export interface PonsV2LaunchedToken {
  version: "v2";
  factory: Address;
  token: Address;
  curve: Address;
  deployer: Address;
  creatorFeeRecipient: Address;
  pairToken: Address;
  graduationThreshold: bigint;
  poolFee: number;
  tickSpacing: number;
  creatorTaxBps: number;
  buybackEnabled: boolean;
  phase: PonsV2GraduationPhase;
  phaseName: (typeof PONS_V2_GRADUATION_PHASE_NAME)[PonsV2GraduationPhase];
  sweptQuote: bigint;
  sweptTokens: bigint;
  sweptAt: bigint;
  exists: boolean;
}

export type PonsLaunchedToken = PonsV1LaunchedToken | PonsV2LaunchedToken;

export interface GetLaunchParams {
  version?: PonsVersion;
  includeLegacy?: boolean;
  factory?: string;
}

export interface PonsGraduationStatus {
  version: "v1";
  factory: Address;
  token: Address;
  pairedPrincipal: bigint;
  threshold: bigint;
  graduated: boolean;
}

export interface PonsV1LaunchConfig {
  version: "v1";
  id: bigint;
  pairToken: Address;
  graduationThreshold: bigint;
  initialTick: number;
  supply: bigint;
  maxWalletBps: number;
  maxTxBps: number;
  restrictionBlocks: number;
  reservedFee: number;
  enabled: boolean;
  routerRequiresDeadline: boolean;
}

export interface PonsV2LaunchConfig {
  version: "v2";
  id: bigint;
  supply: bigint;
  curveFeeBps: bigint;
  phantomQuote: bigint;
  graduationThreshold: bigint;
  poolFee: number;
  tickSpacing: number;
  enabled: boolean;
}

export type PonsLaunchConfig = PonsV1LaunchConfig | PonsV2LaunchConfig;

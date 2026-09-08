import type { PonsVersion } from "../contracts/addresses.js";
import type { PonsDatabase } from "../storage/Database.js";
import type { GetLaunchesParams, PonsLaunch } from "../types/launch.js";

export const PONS_TOKEN_LAUNCHED_STATE_NAME = "pons-token-launched-v1-v2";

export interface PonsLaunchSource {
  getLaunches(params: GetLaunchesParams): Promise<PonsLaunch[]>;
  getBlockNumber(): Promise<bigint>;
  getBlockTimestamp(blockNumber: bigint): Promise<bigint>;
}

export interface IndexedLaunch {
  version: PonsVersion;
  token: string;
  deployer: string;
  factory: string;
  dexFactory: string | null;
  pairToken: string | null;
  pool: string | null;
  curve: string | null;
  dexId: string | null;
  launchConfigId: string | null;
  positionId: string | null;
  restrictionsEndBlock: string | null;
  initialBuyAmount: string | null;
  graduationThreshold: string | null;
  blockNumber: string;
  transactionHash: string;
  transactionIndex: string | null;
  logIndex: string;
  timestamp: string | null;
  createdAt: string;
}

export interface IndexedLaunchQuery {
  version?: PonsVersion;
  token?: string;
  deployer?: string;
  pool?: string;
  fromBlock?: bigint;
  toBlock?: bigint;
  limit?: number;
}

export interface PonsIndexerSyncParams {
  fromBlock?: bigint;
  toBlock?: bigint | "latest";
  chunkSize?: bigint;
  version?: PonsVersion | readonly PonsVersion[];
  includeLegacy?: boolean;
}

export interface PonsIndexerSyncResult {
  fromBlock: bigint;
  toBlock: bigint;
  chunks: number;
  found: number;
  inserted: number;
  lastProcessedBlock: bigint | null;
}

export interface PonsIndexerProgressEvent {
  fromBlock: bigint;
  toBlock: bigint;
  found: number;
  inserted: number;
  cursor: bigint;
}

export type PonsIndexerProgressFn = (event: PonsIndexerProgressEvent) => void;

export interface PonsIndexerSyncStatus {
  name: string;
  lastProcessedBlock: bigint | null;
  launchCount: number;
}

export interface PonsIndexerConfig {
  client: PonsLaunchSource;
  database: PonsDatabase;
  chunkSize?: bigint;
  stateName?: string;
  includeLegacy?: boolean;
  version?: PonsVersion | readonly PonsVersion[];
  resolveTimestamps?: boolean;
  onProgress?: PonsIndexerProgressFn;
}

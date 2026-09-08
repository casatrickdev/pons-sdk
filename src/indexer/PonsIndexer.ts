import { DEFAULT_LOG_CHUNK_SIZE } from "../events/blockRange.js";
import { PonsConfigError } from "../errors/PonsError.js";
import type { PonsDatabase } from "../storage/Database.js";
import { LaunchRepository } from "../storage/repositories/LaunchRepository.js";
import { PONS_VERSIONS, type PonsVersion } from "../contracts/addresses.js";
import { readIndexerCursor } from "./cursor.js";
import { syncTokenLaunched } from "./sync.js";
import type {
  IndexedLaunch,
  IndexedLaunchQuery,
  PonsIndexerConfig,
  PonsIndexerSyncParams,
  PonsIndexerSyncResult,
  PonsIndexerSyncStatus,
  PonsLaunchSource,
} from "./types.js";
import { PONS_TOKEN_LAUNCHED_STATE_NAME } from "./types.js";

const DEFAULT_INDEXER_VERSIONS: readonly PonsVersion[] = PONS_VERSIONS;

export class PonsIndexer {
  private readonly client: PonsLaunchSource;
  private readonly database: PonsDatabase;
  private readonly repository: LaunchRepository;
  private readonly chunkSize: bigint;
  private readonly stateName: string;
  private readonly includeLegacy: boolean;
  private readonly version: PonsVersion | readonly PonsVersion[];
  private readonly resolveTimestamps: boolean;
  private readonly onProgress: PonsIndexerConfig["onProgress"];

  constructor(config: PonsIndexerConfig) {
    if (config.chunkSize !== undefined && config.chunkSize <= 0n) {
      throw new PonsConfigError("chunkSize must be greater than 0", { field: "chunkSize" });
    }

    this.client = config.client;
    this.database = config.database;
    this.repository = new LaunchRepository(config.database);
    this.chunkSize = config.chunkSize ?? DEFAULT_LOG_CHUNK_SIZE;
    this.stateName = config.stateName ?? PONS_TOKEN_LAUNCHED_STATE_NAME;
    this.includeLegacy = config.includeLegacy ?? true;
    this.version = config.version ?? DEFAULT_INDEXER_VERSIONS;
    this.resolveTimestamps = config.resolveTimestamps ?? true;
    this.onProgress = config.onProgress;
  }

  async sync(params: PonsIndexerSyncParams = {}): Promise<PonsIndexerSyncResult> {
    return syncTokenLaunched({
      client: this.client,
      database: this.database,
      repository: this.repository,
      params,
      chunkSize: this.chunkSize,
      stateName: this.stateName,
      includeLegacy: this.includeLegacy,
      version: this.version,
      resolveTimestamps: this.resolveTimestamps,
      onProgress: this.onProgress,
    });
  }

  getLaunch(token: string): IndexedLaunch | undefined {
    return this.repository.getLaunch(token);
  }

  getLaunches(query: IndexedLaunchQuery = {}): IndexedLaunch[] {
    return this.repository.getLaunches(query, "ASC");
  }

  countLaunches(query: IndexedLaunchQuery = {}): number {
    return this.repository.countLaunches(query);
  }

  getLatestLaunches(limit: number): IndexedLaunch[] {
    if (limit < 0) {
      throw new PonsConfigError("limit must be greater than or equal to 0", { field: "limit" });
    }

    return this.repository.getLaunches({ limit }, "DESC");
  }

  getSyncStatus(): PonsIndexerSyncStatus {
    return {
      name: this.stateName,
      lastProcessedBlock: readIndexerCursor(this.database, this.stateName) ?? null,
      launchCount: this.repository.countLaunches(),
    };
  }
}

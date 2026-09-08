import { resolveToBlock, splitBlockRange } from "../events/blockRange.js";
import { PonsConfigError } from "../errors/PonsError.js";
import type { LaunchRepository } from "../storage/repositories/LaunchRepository.js";
import type { PonsDatabase } from "../storage/Database.js";
import type { PonsLaunch } from "../types/launch.js";
import { readIndexerCursor, writeIndexerCursor } from "./cursor.js";
import { uniqueLaunches } from "./dedupe.js";
import type {
  PonsIndexerProgressFn,
  PonsIndexerSyncParams,
  PonsIndexerSyncResult,
  PonsLaunchSource,
} from "./types.js";
import type { PonsVersion } from "../contracts/addresses.js";

export interface SyncTokenLaunchedOptions {
  client: PonsLaunchSource;
  database: PonsDatabase;
  repository: LaunchRepository;
  params: PonsIndexerSyncParams;
  chunkSize: bigint;
  stateName: string;
  includeLegacy: boolean;
  version: PonsVersion | readonly PonsVersion[];
  resolveTimestamps: boolean;
  onProgress?: PonsIndexerProgressFn;
}

async function resolveLaunchTimestamps(
  client: PonsLaunchSource,
  launches: readonly PonsLaunch[],
  cache: Map<string, bigint>,
): Promise<Map<string, bigint>> {
  const timestamps = new Map<string, bigint>();
  const missing: bigint[] = [];
  const queued = new Set<string>();

  for (const launch of launches) {
    const key = launch.blockNumber.toString();
    const cached = cache.get(key);
    if (cached !== undefined) {
      timestamps.set(key, cached);
      continue;
    }
    if (queued.has(key)) {
      continue;
    }
    queued.add(key);
    missing.push(launch.blockNumber);
  }

  for (const blockNumber of missing) {
    const timestamp = await client.getBlockTimestamp(blockNumber);
    const key = blockNumber.toString();
    cache.set(key, timestamp);
    timestamps.set(key, timestamp);
  }

  return timestamps;
}

export async function syncTokenLaunched(
  options: SyncTokenLaunchedOptions,
): Promise<PonsIndexerSyncResult> {
  const chunkSize = options.params.chunkSize ?? options.chunkSize;
  if (chunkSize <= 0n) {
    throw new PonsConfigError("chunkSize must be greater than 0", { field: "chunkSize" });
  }

  const latestBlock = await options.client.getBlockNumber();
  const toBlock = resolveToBlock(options.params.toBlock, latestBlock);
  const cursor = readIndexerCursor(options.database, options.stateName);

  let fromBlock: bigint;
  if (options.params.fromBlock !== undefined) {
    fromBlock = options.params.fromBlock;
  } else if (cursor !== undefined) {
    fromBlock = cursor + 1n;
  } else {
    throw new PonsConfigError("fromBlock is required for the first sync", {
      field: "fromBlock",
    });
  }

  if (fromBlock < 0n) {
    throw new PonsConfigError("fromBlock must be greater than or equal to 0", {
      field: "fromBlock",
    });
  }

  if (fromBlock > toBlock) {
    return {
      fromBlock,
      toBlock,
      chunks: 0,
      found: 0,
      inserted: 0,
      lastProcessedBlock: cursor ?? null,
    };
  }

  const chunks = splitBlockRange(fromBlock, toBlock, chunkSize);
  const timestampCache = new Map<string, bigint>();
  let found = 0;
  let inserted = 0;

  for (const chunk of chunks) {
    const launches = uniqueLaunches(
      await options.client.getLaunches({
        fromBlock: chunk.fromBlock,
        toBlock: chunk.toBlock,
        chunkSize: chunk.toBlock - chunk.fromBlock + 1n,
        version: options.params.version ?? options.version,
        includeLegacy: options.params.includeLegacy ?? options.includeLegacy,
      }),
    );

    const timestamps = options.resolveTimestamps
      ? await resolveLaunchTimestamps(options.client, launches, timestampCache)
      : new Map<string, bigint>();

    const chunkInserted = options.database.transaction(() => {
      const written = options.repository.insertLaunches(launches, timestamps);
      writeIndexerCursor(options.database, chunk.toBlock, options.stateName);
      return written;
    });

    found += launches.length;
    inserted += chunkInserted;
    const nextCursor = readIndexerCursor(options.database, options.stateName) ?? chunk.toBlock;
    options.onProgress?.({
      fromBlock: chunk.fromBlock,
      toBlock: chunk.toBlock,
      found: launches.length,
      inserted: chunkInserted,
      cursor: nextCursor,
    });
  }

  return {
    fromBlock,
    toBlock,
    chunks: chunks.length,
    found,
    inserted,
    lastProcessedBlock: readIndexerCursor(options.database, options.stateName) ?? null,
  };
}

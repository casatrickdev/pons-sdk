import { vi } from "vitest";
import type { PonsLaunchSource } from "../../src/indexer/types.js";
import type { GetLaunchesParams, PonsLaunch } from "../../src/types/launch.js";

function resolveToBlock(toBlock: bigint | "latest" | undefined, latest: bigint): bigint {
  if (toBlock === undefined || toBlock === "latest") {
    return latest;
  }
  return toBlock;
}

export function createMockLaunchSource(
  options: {
    launches?: PonsLaunch[] | ((params: GetLaunchesParams) => PonsLaunch[]);
    blockNumber?: bigint;
    timestamps?: Map<string, bigint> | ((blockNumber: bigint) => bigint);
    getLaunchesError?: Error | ((params: GetLaunchesParams) => Error | undefined);
  } = {},
): PonsLaunchSource & {
  getLaunches: ReturnType<typeof vi.fn>;
  getBlockTimestamp: ReturnType<typeof vi.fn>;
} {
  const latest = options.blockNumber ?? 10_000n;

  const source: PonsLaunchSource & {
    getLaunches: ReturnType<typeof vi.fn>;
    getBlockTimestamp: ReturnType<typeof vi.fn>;
  } = {
    getBlockNumber: vi.fn(() => Promise.resolve(latest)),
    getLaunches: vi.fn((params: GetLaunchesParams) => {
      const error =
        typeof options.getLaunchesError === "function"
          ? options.getLaunchesError(params)
          : options.getLaunchesError;
      if (error !== undefined) {
        return Promise.reject(error);
      }

      const toBlock = resolveToBlock(params.toBlock, latest);
      const all =
        typeof options.launches === "function"
          ? options.launches(params)
          : (options.launches ?? []);

      const versions =
        params.version === undefined
          ? undefined
          : typeof params.version === "string"
            ? [params.version]
            : [...params.version];

      const filtered = all.filter((launch) => {
        if (launch.blockNumber < params.fromBlock || launch.blockNumber > toBlock) {
          return false;
        }
        if (versions !== undefined && !versions.includes(launch.version)) {
          return false;
        }
        if (
          params.token !== undefined &&
          launch.token.toLowerCase() !== params.token.toLowerCase()
        ) {
          return false;
        }
        if (
          params.deployer !== undefined &&
          launch.deployer.toLowerCase() !== params.deployer.toLowerCase()
        ) {
          return false;
        }
        return true;
      });

      return Promise.resolve(filtered);
    }),
    getBlockTimestamp: vi.fn((blockNumber: bigint) => {
      if (typeof options.timestamps === "function") {
        return Promise.resolve(options.timestamps(blockNumber));
      }
      if (options.timestamps !== undefined) {
        const value = options.timestamps.get(blockNumber.toString());
        if (value === undefined) {
          return Promise.reject(new Error(`missing timestamp for block ${blockNumber.toString()}`));
        }
        return Promise.resolve(value);
      }
      return Promise.resolve(blockNumber * 12n);
    }),
  };

  return source;
}

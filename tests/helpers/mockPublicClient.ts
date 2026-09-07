import { vi } from "vitest";
import type { PonsPublicClient } from "../../src/internal/rpc.js";
import type { TokenLaunchedLogInput } from "../../src/types/event.js";

export interface MockGetLogsCall {
  address: string;
  fromBlock: bigint;
  toBlock: bigint;
  args?: { token?: string; deployer?: string };
}

interface MockGetLogsParams {
  address?: unknown;
  fromBlock?: bigint;
  toBlock?: bigint;
  args?: { token?: string; deployer?: string };
}

export function createMockPublicClient(
  options: {
    blockNumber?: bigint;
    logs?: TokenLaunchedLogInput[] | ((call: MockGetLogsCall) => TokenLaunchedLogInput[]);
    getLogsError?: Error;
    readContract?: PonsPublicClient["readContract"];
  } = {},
): PonsPublicClient & { getLogsCalls: MockGetLogsCall[] } {
  const getLogsCalls: MockGetLogsCall[] = [];

  const client: PonsPublicClient & { getLogsCalls: MockGetLogsCall[] } = {
    getLogsCalls,
    getBlockNumber: vi.fn(() => Promise.resolve(options.blockNumber ?? 10_000n)),
    getLogs: vi.fn((params?: MockGetLogsParams) => {
      if (options.getLogsError !== undefined) {
        throw options.getLogsError;
      }

      const resolved = params ?? {};
      const call: MockGetLogsCall = {
        address: String(resolved.address),
        fromBlock: resolved.fromBlock ?? 0n,
        toBlock: resolved.toBlock ?? 0n,
        args: resolved.args,
      };
      getLogsCalls.push(call);

      const logs = typeof options.logs === "function" ? options.logs(call) : (options.logs ?? []);
      return Promise.resolve(logs as never);
    }) as PonsPublicClient["getLogs"],
    readContract:
      options.readContract ??
      vi.fn(() => {
        throw new Error("readContract is not mocked");
      }),
  };

  return client;
}

export function silentDebug(): void {
  return undefined;
}

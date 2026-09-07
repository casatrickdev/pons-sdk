import type { AbiEvent, Address, Log } from "viem";
import { ROBINHOOD_CHAIN_ID } from "../chain/robinhoodChain.js";
import { ponsV1FactoryAbi, ponsV2FactoryAbi } from "../contracts/abis.js";
import { PONS_CONTRACTS, type PonsVersion } from "../contracts/addresses.js";
import { PonsConfigError, PonsRpcError, errorMessage } from "../errors/PonsError.js";
import type { PonsDebugFn } from "../types/config.js";
import type { TokenLaunchedLogInput } from "../types/event.js";
import type { GetTokenLaunchedLogsParams } from "../types/launch.js";
import { optionalAddress } from "../validation/address.js";
import { DEFAULT_LOG_CHUNK_SIZE, resolveToBlock, splitBlockRange } from "./blockRange.js";
import type { PonsPublicClient } from "../internal/rpc.js";
import { readChainBlockNumber } from "../internal/rpc.js";

export interface FactoryQueryTarget {
  version: PonsVersion;
  factory: Address;
}

export function resolveFactoryTargets(
  version: PonsVersion | readonly PonsVersion[] | undefined,
  includeLegacy: boolean,
): FactoryQueryTarget[] {
  const versions: PonsVersion[] =
    version === undefined ? ["v1"] : typeof version === "string" ? [version] : [...version];

  const unique = new Set<PonsVersion>();
  for (const item of versions) {
    if (item !== "v1" && item !== "v2") {
      throw new PonsConfigError(`Unsupported Pons version: ${String(item)}`, { field: "version" });
    }
    unique.add(item);
  }

  const targets: FactoryQueryTarget[] = [];

  if (unique.has("v1")) {
    targets.push({ version: "v1", factory: PONS_CONTRACTS.v1.factory });
    if (includeLegacy) {
      targets.push({ version: "v1", factory: PONS_CONTRACTS.v1.legacy.factory });
    }
  }

  if (unique.has("v2")) {
    targets.push({ version: "v2", factory: PONS_CONTRACTS.v2.factory });
  }

  return targets;
}

function tokenLaunchedEvent(version: PonsVersion): AbiEvent {
  const event = version === "v1" ? ponsV1FactoryAbi[0] : ponsV2FactoryAbi[0];
  if (event === undefined || event.type !== "event") {
    throw new PonsConfigError("TokenLaunched ABI fragment is missing", { field: "event" });
  }
  return event;
}

function toTokenLaunchedLogInput(log: Log): TokenLaunchedLogInput {
  return {
    address: log.address,
    topics: log.topics,
    data: log.data,
    blockNumber: log.blockNumber,
    transactionHash: log.transactionHash,
    transactionIndex: log.transactionIndex,
    logIndex: log.logIndex,
  };
}

export interface QueryTokenLaunchedLogsContext {
  client: PonsPublicClient;
  debug: PonsDebugFn;
  defaultChunkSize: bigint;
}

export async function queryTokenLaunchedLogs(
  params: GetTokenLaunchedLogsParams,
  context: QueryTokenLaunchedLogsContext,
): Promise<TokenLaunchedLogInput[]> {
  const token = optionalAddress(params.token, "token");
  const deployer = optionalAddress(params.deployer, "deployer");
  const chunkSize = params.chunkSize ?? context.defaultChunkSize ?? DEFAULT_LOG_CHUNK_SIZE;
  const targets = resolveFactoryTargets(params.version, params.includeLegacy === true);

  const latestBlock = await readChainBlockNumber(context.client, "getTokenLaunchedLogs");
  const toBlock = resolveToBlock(params.toBlock, latestBlock);
  const chunks = splitBlockRange(params.fromBlock, toBlock, chunkSize);

  context.debug("getTokenLaunchedLogs", {
    fromBlock: params.fromBlock.toString(),
    toBlock: toBlock.toString(),
    chunkCount: chunks.length,
    factories: targets.map((target) => target.factory),
  });

  const logs: TokenLaunchedLogInput[] = [];

  for (const target of targets) {
    const event = tokenLaunchedEvent(target.version);

    for (const chunk of chunks) {
      try {
        const chunkLogs = await context.client.getLogs({
          address: target.factory,
          event,
          args: {
            ...(token === undefined ? {} : { token }),
            ...(deployer === undefined ? {} : { deployer }),
          },
          fromBlock: chunk.fromBlock,
          toBlock: chunk.toBlock,
          strict: true,
        });

        for (const log of chunkLogs) {
          logs.push(toTokenLaunchedLogInput(log));
        }
      } catch (error) {
        if (error instanceof PonsRpcError) {
          throw error;
        }

        throw new PonsRpcError(
          `eth_getLogs failed for ${target.factory} in [${chunk.fromBlock}, ${chunk.toBlock}]: ${errorMessage(error)}`,
          {
            operation: "getTokenLaunchedLogs",
            chainId: ROBINHOOD_CHAIN_ID,
            fromBlock: chunk.fromBlock,
            toBlock: chunk.toBlock,
            cause: error,
          },
        );
      }
    }
  }

  return logs;
}

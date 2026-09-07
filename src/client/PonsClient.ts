import { type PublicClient, createPublicClient, http } from "viem";
import {
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_CHAIN_RPC_URL,
  robinhoodChain,
} from "../chain/robinhoodChain.js";
import type { PonsVersion } from "../contracts/addresses.js";
import { createDebugLogger } from "../debug.js";
import { DEFAULT_LOG_CHUNK_SIZE } from "../events/blockRange.js";
import { queryTokenLaunchedLogs } from "../events/getTokenLaunchedLogs.js";
import { PonsConfigError, PonsRpcError, errorMessage } from "../errors/PonsError.js";
import {
  queryLaunch,
  queryCanLaunch,
  queryGraduationStatus,
  queryLaunchConfig,
  queryLaunchFee,
} from "../launches/getLaunch.js";
import { queryLaunches } from "../launches/getLaunches.js";
import type { PonsClientConfig, PonsDebugFn } from "../types/config.js";
import type { TokenLaunchedLogInput } from "../types/event.js";
import type {
  GetLaunchParams,
  GetLaunchesParams,
  GetTokenLaunchedLogsParams,
  PonsGraduationStatus,
  PonsLaunch,
  PonsLaunchConfig,
  PonsLaunchedToken,
} from "../types/launch.js";

function validateRpcUrl(rpcUrl: string): string {
  const trimmed = rpcUrl.trim();
  if (trimmed.length === 0) {
    throw new PonsConfigError("rpcUrl must be a non-empty string", { field: "rpcUrl" });
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new PonsConfigError(`rpcUrl must use http or https: ${trimmed}`, { field: "rpcUrl" });
    }
  } catch (error) {
    if (error instanceof PonsConfigError) {
      throw error;
    }
    throw new PonsConfigError(`rpcUrl is not a valid URL: ${trimmed}`, { field: "rpcUrl" });
  }

  return trimmed;
}

function validateChunkSize(chunkSize: bigint | undefined): bigint {
  if (chunkSize === undefined) {
    return DEFAULT_LOG_CHUNK_SIZE;
  }

  if (chunkSize <= 0n) {
    throw new PonsConfigError("defaultChunkSize must be greater than 0", {
      field: "defaultChunkSize",
    });
  }

  return chunkSize;
}

export class PonsClient {
  readonly chainId: number = ROBINHOOD_CHAIN_ID;
  readonly rpcUrl: string;

  private readonly publicClient: PublicClient;
  private readonly debug: PonsDebugFn;
  private readonly defaultChunkSize: bigint;

  constructor(config: PonsClientConfig = {}) {
    this.rpcUrl =
      config.rpcUrl === undefined ? ROBINHOOD_CHAIN_RPC_URL : validateRpcUrl(config.rpcUrl);
    this.debug = createDebugLogger(config.debug);
    this.defaultChunkSize = validateChunkSize(config.defaultChunkSize);

    this.publicClient = createPublicClient({
      chain: robinhoodChain,
      transport: config.transport ?? http(this.rpcUrl),
    });
  }

  async getBlockNumber(): Promise<bigint> {
    try {
      return await this.publicClient.getBlockNumber();
    } catch (error) {
      throw new PonsRpcError(`RPC call failed during getBlockNumber: ${errorMessage(error)}`, {
        operation: "getBlockNumber",
        chainId: this.chainId,
        cause: error,
      });
    }
  }

  async getLaunches(params: GetLaunchesParams): Promise<PonsLaunch[]> {
    return queryLaunches(params, this.queryContext());
  }

  async getTokenLaunchedLogs(params: GetTokenLaunchedLogsParams): Promise<TokenLaunchedLogInput[]> {
    return queryTokenLaunchedLogs(params, this.queryContext());
  }

  async getLaunch(token: string, params: GetLaunchParams = {}): Promise<PonsLaunchedToken> {
    return queryLaunch(token, params, this.queryContext());
  }

  async getGraduationStatus(
    token: string,
    params: Pick<GetLaunchParams, "factory" | "includeLegacy"> = {},
  ): Promise<PonsGraduationStatus> {
    return queryGraduationStatus(token, params, this.queryContext());
  }

  async canLaunch(launcher: string): Promise<boolean> {
    return queryCanLaunch(launcher, this.queryContext());
  }

  async getLaunchConfig(id: bigint, version: PonsVersion = "v1"): Promise<PonsLaunchConfig> {
    return queryLaunchConfig(id, version, this.queryContext());
  }

  async getLaunchFee(version: PonsVersion = "v1"): Promise<bigint> {
    return queryLaunchFee(version, this.queryContext());
  }

  private queryContext() {
    return {
      client: this.publicClient,
      debug: this.debug,
      defaultChunkSize: this.defaultChunkSize,
    };
  }
}

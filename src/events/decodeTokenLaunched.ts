import {
  type Address,
  type Hash,
  type Hex,
  decodeEventLog,
  getAddress,
  isAddress,
  isHash,
  isHex,
} from "viem";
import {
  PONS_V1_TOKEN_LAUNCHED_TOPIC,
  PONS_V2_TOKEN_LAUNCHED_TOPIC,
  ponsV1FactoryAbi,
  ponsV2FactoryAbi,
} from "../contracts/abis.js";
import { PONS_CONTRACTS, type PonsVersion } from "../contracts/addresses.js";
import { PonsContractError } from "../errors/PonsError.js";
import type { NormalizedTokenLaunchedLog, TokenLaunchedLogInput } from "../types/event.js";
import type { PonsLaunch, PonsV1Launch, PonsV2Launch } from "../types/launch.js";

function parseBigInt(value: bigint | number | string | null | undefined, field: string): bigint {
  if (value === null || value === undefined) {
    throw new PonsContractError(`TokenLaunched log is missing ${field}`, {
      operation: "decodeTokenLaunched",
    });
  }

  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0) {
      throw new PonsContractError(`TokenLaunched log has an invalid ${field}: ${value}`, {
        operation: "decodeTokenLaunched",
      });
    }
    return BigInt(value);
  }

  try {
    return BigInt(value);
  } catch {
    throw new PonsContractError(`TokenLaunched log has an invalid ${field}: ${value}`, {
      operation: "decodeTokenLaunched",
    });
  }
}

function parseHash(value: string | null | undefined, field: string): Hash {
  if (value === null || value === undefined || !isHash(value)) {
    throw new PonsContractError(`TokenLaunched log is missing a valid ${field}`, {
      operation: "decodeTokenLaunched",
    });
  }

  return value;
}

function parseHex(value: string, field: string): Hex {
  if (!isHex(value)) {
    throw new PonsContractError(`TokenLaunched log has an invalid ${field}`, {
      operation: "decodeTokenLaunched",
    });
  }

  return value;
}

function parseLogAddress(value: string): Address {
  if (!isAddress(value, { strict: false })) {
    throw new PonsContractError(`TokenLaunched log has an invalid address: ${value}`, {
      operation: "decodeTokenLaunched",
    });
  }

  return getAddress(value);
}

export function normalizeTokenLaunchedLog(log: TokenLaunchedLogInput): NormalizedTokenLaunchedLog {
  const topics = log.topics;
  if (topics.length === 0) {
    throw new PonsContractError("TokenLaunched log is missing topics", {
      operation: "decodeTokenLaunched",
    });
  }

  return {
    address: parseLogAddress(log.address),
    topics: topics.map((topic, index) => parseHex(topic, `topics[${String(index)}]`)),
    data: parseHex(log.data, "data"),
    blockNumber: parseBigInt(log.blockNumber, "blockNumber"),
    transactionHash: parseHash(log.transactionHash, "transactionHash"),
    transactionIndex: parseBigInt(log.transactionIndex, "transactionIndex"),
    logIndex: parseBigInt(log.logIndex, "logIndex"),
  };
}

function inferTokenLaunchedVersion(log: NormalizedTokenLaunchedLog): PonsVersion {
  const topic0 = log.topics[0];
  if (topic0 === PONS_V1_TOKEN_LAUNCHED_TOPIC) {
    return "v1";
  }
  if (topic0 === PONS_V2_TOKEN_LAUNCHED_TOPIC) {
    return "v2";
  }

  if (
    log.address === PONS_CONTRACTS.v1.factory ||
    log.address === PONS_CONTRACTS.v1.legacy.factory
  ) {
    return "v1";
  }
  if (log.address === PONS_CONTRACTS.v2.factory) {
    return "v2";
  }

  throw new PonsContractError("Unable to determine TokenLaunched event version", {
    operation: "decodeTokenLaunched",
    address: log.address,
  });
}

function asEventTopics(topics: readonly Hex[]): [Hex, ...Hex[]] {
  const [signature, ...rest] = topics;
  if (signature === undefined) {
    throw new PonsContractError("TokenLaunched log is missing topics", {
      operation: "decodeTokenLaunched",
    });
  }

  return [signature, ...rest];
}

function decodeV1(log: NormalizedTokenLaunchedLog): PonsV1Launch {
  try {
    const decoded = decodeEventLog({
      abi: ponsV1FactoryAbi,
      eventName: "TokenLaunched",
      data: log.data,
      topics: asEventTopics(log.topics),
      strict: true,
    });

    return {
      version: "v1",
      factory: log.address,
      token: getAddress(decoded.args.token),
      deployer: getAddress(decoded.args.deployer),
      dexFactory: getAddress(decoded.args.dexFactory),
      pairToken: getAddress(decoded.args.pairToken),
      pool: getAddress(decoded.args.pool),
      dexId: decoded.args.dexId,
      launchConfigId: decoded.args.launchConfigId,
      positionId: decoded.args.positionId,
      restrictionsEndBlock: decoded.args.restrictionsEndBlock,
      initialBuyAmount: decoded.args.initialBuyAmount,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      transactionIndex: log.transactionIndex,
      logIndex: log.logIndex,
    };
  } catch (error) {
    throw new PonsContractError("Failed to decode V1 TokenLaunched log", {
      operation: "decodeTokenLaunched",
      address: log.address,
      version: "v1",
      cause: error,
    });
  }
}

function decodeV2(log: NormalizedTokenLaunchedLog): PonsV2Launch {
  try {
    const decoded = decodeEventLog({
      abi: ponsV2FactoryAbi,
      eventName: "TokenLaunched",
      data: log.data,
      topics: asEventTopics(log.topics),
      strict: true,
    });

    return {
      version: "v2",
      factory: log.address,
      token: getAddress(decoded.args.token),
      curve: getAddress(decoded.args.curve),
      deployer: getAddress(decoded.args.deployer),
      pairToken: getAddress(decoded.args.pairToken),
      launchConfigId: decoded.args.launchConfigId,
      graduationThreshold: decoded.args.graduationThreshold,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      transactionIndex: log.transactionIndex,
      logIndex: log.logIndex,
    };
  } catch (error) {
    throw new PonsContractError("Failed to decode V2 TokenLaunched log", {
      operation: "decodeTokenLaunched",
      address: log.address,
      version: "v2",
      cause: error,
    });
  }
}

export function decodeTokenLaunched(log: TokenLaunchedLogInput, version?: PonsVersion): PonsLaunch {
  const normalized = normalizeTokenLaunchedLog(log);
  const resolvedVersion = version ?? inferTokenLaunchedVersion(normalized);

  if (resolvedVersion === "v1") {
    return decodeV1(normalized);
  }

  return decodeV2(normalized);
}

export function launchIdentity(launch: PonsLaunch): string {
  return `${launch.transactionHash.toLowerCase()}:${launch.logIndex.toString()}`;
}

export function compareLaunches(a: PonsLaunch, b: PonsLaunch): number {
  if (a.blockNumber !== b.blockNumber) {
    return a.blockNumber < b.blockNumber ? -1 : 1;
  }
  if (a.transactionIndex !== b.transactionIndex) {
    return a.transactionIndex < b.transactionIndex ? -1 : 1;
  }
  if (a.logIndex !== b.logIndex) {
    return a.logIndex < b.logIndex ? -1 : 1;
  }
  return 0;
}

export function dedupeAndSortLaunches(launches: readonly PonsLaunch[]): PonsLaunch[] {
  const seen = new Set<string>();
  const unique: PonsLaunch[] = [];

  for (const launch of launches) {
    const id = launchIdentity(launch);
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    unique.push(launch);
  }

  return unique.sort(compareLaunches);
}

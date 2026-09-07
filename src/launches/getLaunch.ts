import { type Address, getAddress } from "viem";
import { ponsV1FactoryAbi, ponsV2FactoryAbi } from "../contracts/abis.js";
import { PONS_CONTRACTS, type PonsVersion } from "../contracts/addresses.js";
import { PonsConfigError, PonsContractError } from "../errors/PonsError.js";
import type { PonsDebugFn } from "../types/config.js";
import type {
  GetLaunchParams,
  PonsGraduationStatus,
  PonsLaunchConfig,
  PonsLaunchedToken,
  PonsV1LaunchConfig,
  PonsV1LaunchedToken,
  PonsV2GraduationPhase,
  PonsV2LaunchConfig,
  PonsV2LaunchedToken,
} from "../types/launch.js";
import { PONS_V2_GRADUATION_PHASE_NAME } from "../types/launch.js";
import { requireAddress } from "../validation/address.js";
import type { PonsPublicClient } from "../internal/rpc.js";
import { readPonsContract } from "../internal/rpc.js";

export interface QueryLaunchContext {
  client: PonsPublicClient;
  debug: PonsDebugFn;
}

function isV2Phase(value: number): value is PonsV2GraduationPhase {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

function v1Factories(includeLegacy: boolean, factory?: Address): Address[] {
  if (factory !== undefined) {
    return [factory];
  }

  const factories: Address[] = [PONS_CONTRACTS.v1.factory];
  if (includeLegacy) {
    factories.push(PONS_CONTRACTS.v1.legacy.factory);
  }
  return factories;
}

async function readV1LaunchedToken(
  client: PonsPublicClient,
  factory: Address,
  token: Address,
  debug: PonsDebugFn,
): Promise<PonsV1LaunchedToken> {
  const launched = await readPonsContract("getLaunchedToken", "v1", factory, debug, () =>
    client.readContract({
      address: factory,
      abi: ponsV1FactoryAbi,
      functionName: "getLaunchedToken",
      args: [token],
    }),
  );

  return {
    version: "v1",
    factory,
    token: getAddress(launched.token),
    deployer: getAddress(launched.deployer),
    pairedToken: getAddress(launched.pairedToken),
    positionManager: getAddress(launched.positionManager),
    positionId: launched.positionId,
    dexId: launched.dexId,
    launchConfigId: launched.launchConfigId,
    restrictionsEndBlock: launched.restrictionsEndBlock,
    supply: launched.supply,
    isToken0: launched.isToken0,
    poolFee: launched.poolFee,
    exists: launched.exists,
    initialBuyAmount: launched.initialBuyAmount,
  };
}

async function readV2LaunchedToken(
  client: PonsPublicClient,
  factory: Address,
  token: Address,
  debug: PonsDebugFn,
): Promise<PonsV2LaunchedToken> {
  const launched = await readPonsContract("getLaunchedToken", "v2", factory, debug, () =>
    client.readContract({
      address: factory,
      abi: ponsV2FactoryAbi,
      functionName: "getLaunchedToken",
      args: [token],
    }),
  );

  if (!isV2Phase(launched.phase)) {
    throw new PonsContractError(`Unexpected V2 graduation phase: ${launched.phase}`, {
      operation: "getLaunchedToken",
      address: factory,
      version: "v2",
    });
  }

  return {
    version: "v2",
    factory,
    token: getAddress(launched.token),
    curve: getAddress(launched.curve),
    deployer: getAddress(launched.deployer),
    creatorFeeRecipient: getAddress(launched.creatorFeeRecipient),
    pairToken: getAddress(launched.pairToken),
    graduationThreshold: launched.graduationThreshold,
    poolFee: launched.poolFee,
    tickSpacing: launched.tickSpacing,
    creatorTaxBps: launched.creatorTaxBps,
    buybackEnabled: launched.buybackEnabled,
    phase: launched.phase,
    phaseName: PONS_V2_GRADUATION_PHASE_NAME[launched.phase],
    sweptQuote: launched.sweptQuote,
    sweptTokens: launched.sweptTokens,
    sweptAt: launched.sweptAt,
    exists: launched.exists,
  };
}

export async function queryLaunch(
  tokenValue: string,
  params: GetLaunchParams = {},
  context: QueryLaunchContext,
): Promise<PonsLaunchedToken> {
  const token = requireAddress(tokenValue, "token");
  const factory =
    params.factory === undefined ? undefined : requireAddress(params.factory, "factory");
  const includeLegacy = params.includeLegacy !== false;

  if (params.version === "v2") {
    const launch = await readV2LaunchedToken(
      context.client,
      factory ?? PONS_CONTRACTS.v2.factory,
      token,
      context.debug,
    );
    if (!launch.exists) {
      throw new PonsContractError(`Token ${token} was not found on the V2 factory`, {
        operation: "getLaunch",
        address: launch.factory,
        version: "v2",
      });
    }
    return launch;
  }

  if (params.version === "v1" || params.version === undefined) {
    for (const candidate of v1Factories(includeLegacy, factory)) {
      const launch = await readV1LaunchedToken(context.client, candidate, token, context.debug);
      if (launch.exists) {
        return launch;
      }
    }

    if (params.version === "v1") {
      throw new PonsContractError(`Token ${token} was not found on the V1 factory`, {
        operation: "getLaunch",
        address: factory ?? PONS_CONTRACTS.v1.factory,
        version: "v1",
      });
    }
  }

  const v2Launch = await readV2LaunchedToken(
    context.client,
    factory ?? PONS_CONTRACTS.v2.factory,
    token,
    context.debug,
  );
  if (v2Launch.exists) {
    return v2Launch;
  }

  throw new PonsContractError(`Token ${token} was not found on a known Pons factory`, {
    operation: "getLaunch",
    address: factory,
  });
}

export async function queryGraduationStatus(
  tokenValue: string,
  params: Pick<GetLaunchParams, "factory" | "includeLegacy"> = {},
  context: QueryLaunchContext,
): Promise<PonsGraduationStatus> {
  const launch = await queryLaunch(tokenValue, { ...params, version: "v1" }, context);
  if (launch.version !== "v1") {
    throw new PonsContractError("graduationStatus is only available on Pons V1", {
      operation: "getGraduationStatus",
      address: launch.factory,
      version: launch.version,
    });
  }

  const [pairedPrincipal, threshold, graduated] = await readPonsContract(
    "graduationStatus",
    "v1",
    launch.factory,
    context.debug,
    () =>
      context.client.readContract({
        address: launch.factory,
        abi: ponsV1FactoryAbi,
        functionName: "graduationStatus",
        args: [launch.token],
      }),
  );

  return {
    version: "v1",
    factory: launch.factory,
    token: launch.token,
    pairedPrincipal,
    threshold,
    graduated,
  };
}

export async function queryCanLaunch(
  launcherValue: string,
  context: QueryLaunchContext,
): Promise<boolean> {
  const launcher = requireAddress(launcherValue, "launcher");

  return readPonsContract("canLaunch", "v2", PONS_CONTRACTS.v2.factory, context.debug, () =>
    context.client.readContract({
      address: PONS_CONTRACTS.v2.factory,
      abi: ponsV2FactoryAbi,
      functionName: "canLaunch",
      args: [launcher],
    }),
  );
}

export async function queryLaunchConfig(
  id: bigint,
  version: PonsVersion,
  context: QueryLaunchContext,
): Promise<PonsLaunchConfig> {
  if (id < 0n) {
    throw new PonsConfigError("launch config id must be greater than or equal to 0", {
      field: "id",
    });
  }

  if (version === "v1") {
    const config = await readPonsContract(
      "getLaunchConfig",
      "v1",
      PONS_CONTRACTS.v1.factory,
      context.debug,
      () =>
        context.client.readContract({
          address: PONS_CONTRACTS.v1.factory,
          abi: ponsV1FactoryAbi,
          functionName: "getLaunchConfig",
          args: [id],
        }),
    );

    const result: PonsV1LaunchConfig = {
      version: "v1",
      id,
      pairToken: getAddress(config.pairToken),
      graduationThreshold: config.graduationThreshold,
      initialTick: config.initialTick,
      supply: config.supply,
      maxWalletBps: config.maxWalletBps,
      maxTxBps: config.maxTxBps,
      restrictionBlocks: config.restrictionBlocks,
      reservedFee: config.reservedFee,
      enabled: config.enabled,
      routerRequiresDeadline: config.routerRequiresDeadline,
    };
    return result;
  }

  const config = await readPonsContract(
    "getLaunchConfig",
    "v2",
    PONS_CONTRACTS.v2.factory,
    context.debug,
    () =>
      context.client.readContract({
        address: PONS_CONTRACTS.v2.factory,
        abi: ponsV2FactoryAbi,
        functionName: "getLaunchConfig",
        args: [id],
      }),
  );

  const result: PonsV2LaunchConfig = {
    version: "v2",
    id,
    supply: config.supply,
    curveFeeBps: config.curveFeeBps,
    phantomQuote: config.phantomQuote,
    graduationThreshold: config.graduationThreshold,
    poolFee: config.poolFee,
    tickSpacing: config.tickSpacing,
    enabled: config.enabled,
  };
  return result;
}

export async function queryLaunchFee(
  version: PonsVersion,
  context: QueryLaunchContext,
): Promise<bigint> {
  const factory = version === "v1" ? PONS_CONTRACTS.v1.factory : PONS_CONTRACTS.v2.factory;
  const abi = version === "v1" ? ponsV1FactoryAbi : ponsV2FactoryAbi;

  return readPonsContract("launchFee", version, factory, context.debug, () =>
    context.client.readContract({
      address: factory,
      abi,
      functionName: "launchFee",
    }),
  );
}

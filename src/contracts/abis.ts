import { parseAbi, toEventSelector } from "viem";

/**
 * Verified V1 factory fragments from the official Pons ABI
 * (https://github.com/ponsdotdev/ponsfamily/blob/master/abi.json)
 * and docs.ponsfamily.com integration guide.
 */
export const ponsV1FactoryAbi = parseAbi([
  "event TokenLaunched(address indexed token, address indexed deployer, address indexed dexFactory, address pairToken, address pool, uint256 dexId, uint256 launchConfigId, uint256 positionId, uint256 restrictionsEndBlock, uint256 initialBuyAmount)",
  "function getLaunchedToken(address token) view returns ((address token, address deployer, address pairedToken, address positionManager, uint256 positionId, uint256 dexId, uint256 launchConfigId, uint256 restrictionsEndBlock, uint256 supply, bool isToken0, uint24 poolFee, bool exists, uint256 initialBuyAmount))",
  "function graduationStatus(address token) view returns (uint256 pairedPrincipal, uint256 threshold, bool graduated)",
  "function getLaunchConfig(uint256 id) view returns ((address pairToken, uint256 graduationThreshold, int24 initialTick, uint256 supply, uint16 maxWalletBps, uint16 maxTxBps, uint32 restrictionBlocks, uint24 reservedFee, bool enabled, bool routerRequiresDeadline))",
  "function launchConfigCount() view returns (uint256)",
  "function launchFee() view returns (uint256)",
  "function locker() view returns (address)",
]);

/**
 * Verified V2 factory fragments from PonsV2LaunchFactory.sol,
 * ILaunchpadV2.sol, and docs.ponsfamily.com/v2.
 */
export const ponsV2FactoryAbi = parseAbi([
  "event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)",
  "function getLaunchedToken(address token) view returns ((address token, address curve, address deployer, address creatorFeeRecipient, address pairToken, uint256 graduationThreshold, uint24 poolFee, int24 tickSpacing, uint16 creatorTaxBps, bool buybackEnabled, uint8 phase, uint256 sweptQuote, uint256 sweptTokens, uint256 sweptAt, bool exists))",
  "function getLaunchConfig(uint256 id) view returns ((uint256 supply, uint256 curveFeeBps, uint256 phantomQuote, uint256 graduationThreshold, uint24 poolFee, int24 tickSpacing, bool enabled))",
  "function canLaunch(address launcher) view returns (bool)",
  "function launchConfigCount() view returns (uint256)",
  "function launchFee() view returns (uint256)",
]);

export const PONS_V1_TOKEN_LAUNCHED_TOPIC = toEventSelector(
  "event TokenLaunched(address indexed token, address indexed deployer, address indexed dexFactory, address pairToken, address pool, uint256 dexId, uint256 launchConfigId, uint256 positionId, uint256 restrictionsEndBlock, uint256 initialBuyAmount)",
);

export const PONS_V2_TOKEN_LAUNCHED_TOPIC = toEventSelector(
  "event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)",
);

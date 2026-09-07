import type { Address, Hash } from "viem";

export const PONS_VERSIONS = ["v1", "v2"] as const;

export type PonsVersion = (typeof PONS_VERSIONS)[number];

/**
 * Official Pons deployments on Robinhood Chain.
 *
 * Sources:
 * - https://docs.ponsfamily.com
 * - https://docs.ponsfamily.com/v2
 * - https://docs.ponsfamily.com/llms.txt
 * - https://github.com/ponsdotdev/ponsfamily
 */
export const PONS_CONTRACTS = {
  v1: {
    factory: "0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB" as Address,
    locker: "0x736D76699C26D0d966744cAe304C000d471f7F35" as Address,
    startBlock: 8_991_118n,
    legacy: {
      factory: "0x0c37a24F5D23A486FA692d1500881d698B1F77a4" as Address,
      locker: "0x31ca5E101941A93A7DD6d0497928700625CF54B5" as Address,
      startBlock: 8_600_612n,
    },
  },
  v2: {
    factory: "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e" as Address,
    memeHook: "0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044" as Address,
    feeEscrow: "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e" as Address,
    buybackVault: "0x42df2a798f82289E177311362e8f5ccC45c1219c" as Address,
    launchLocker: "0x267444D099b10fB5Ed7c3Cc7B7c767AdcA574952" as Address,
    launchAndBuy: "0xe33E9E479dF8802cb0866d5d05258bEc4cF62948" as Address,
    launchDeployer: "0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42" as Address,
    graduationExecutor: "0xC7819B64A1dAECD7eC19856d026cb14EfBd89046" as Address,
    graduationGuard: "0xf5695117b99B6f6401e67d4195BD653628176C6C" as Address,
  },
} as const;

export const PONS_WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" as Address;

/**
 * Official reference token from Pons documentation.
 * Launched through the V1 legacy factory.
 */
export const PONS_REFERENCE = {
  token: "0x39dBED3a2bd333467115dE45665cC57F813C4571" as Address,
  pool: "0x10CC6BD38112cAc182db90B6a71d8Bb5939526bA" as Address,
  launchTx: "0x1f54f25fec2d963dcb338ecb8b46a6eb123198a5c7a746d34cb2dbe78d074af8" as Hash,
} as const;

export function isPonsVersion(value: string): value is PonsVersion {
  return (PONS_VERSIONS as readonly string[]).includes(value);
}

export function getPonsFactoryAddress(version: PonsVersion): Address {
  return PONS_CONTRACTS[version].factory;
}

import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { PONS_CONTRACTS } from "../src/contracts/addresses.js";
import { DEFAULT_LOG_CHUNK_SIZE, splitBlockRange } from "../src/events/blockRange.js";
import { decodeTokenLaunched, dedupeAndSortLaunches } from "../src/events/decodeTokenLaunched.js";
import { PonsConfigError, PonsContractError, PonsRpcError } from "../src/errors/PonsError.js";
import type { PonsPublicClient } from "../src/internal/rpc.js";
import { queryLaunch } from "../src/launches/getLaunch.js";
import { queryLaunches } from "../src/launches/getLaunches.js";
import type { TokenLaunchedLogInput } from "../src/types/event.js";
import type { PonsV1Launch } from "../src/types/launch.js";
import v1Fixture from "./fixtures/tokenLaunched.v1.json" with { type: "json" };
import { createMockPublicClient, silentDebug } from "./helpers/mockPublicClient.js";

function shiftLog(
  log: TokenLaunchedLogInput,
  overrides: Partial<TokenLaunchedLogInput>,
): TokenLaunchedLogInput {
  return { ...log, ...overrides };
}

describe("block range splitting", () => {
  it("keeps a small range as a single chunk", () => {
    expect(splitBlockRange(100n, 150n, 2_000n)).toEqual([{ fromBlock: 100n, toBlock: 150n }]);
  });

  it("splits a large range into contiguous non-overlapping chunks", () => {
    expect(splitBlockRange(1n, 5_000n, 2_000n)).toEqual([
      { fromBlock: 1n, toBlock: 2_000n },
      { fromBlock: 2_001n, toBlock: 4_000n },
      { fromBlock: 4_001n, toBlock: 5_000n },
    ]);
  });

  it("includes a final partial chunk", () => {
    expect(splitBlockRange(10n, 12n, 2n)).toEqual([
      { fromBlock: 10n, toBlock: 11n },
      { fromBlock: 12n, toBlock: 12n },
    ]);
  });

  it("rejects an inverted or empty chunk size", () => {
    expect(() => splitBlockRange(20n, 10n, 2n)).toThrow(PonsConfigError);
    expect(() => splitBlockRange(1n, 10n, 0n)).toThrow(PonsConfigError);
  });
});

describe("queryLaunches", () => {
  it("queries a small range once and decodes launches", async () => {
    const client = createMockPublicClient({
      blockNumber: 9_000_000n,
      logs: [v1Fixture.log],
    });

    const launches = await queryLaunches(
      { fromBlock: 8_991_118n, toBlock: 8_991_200n, includeLegacy: true },
      { client, debug: silentDebug, defaultChunkSize: DEFAULT_LOG_CHUNK_SIZE },
    );

    expect(client.getLogsCalls).toHaveLength(2);
    expect(launches).toHaveLength(1);
    expect(launches[0]?.token).toBe(getAddress("0x39dbed3a2bd333467115de45665cc57f813c4571"));
    expect(launches[0]?.transactionHash).toBe(v1Fixture.log.transactionHash);
  });

  it("splits large ranges into multiple getLogs chunks", async () => {
    const client = createMockPublicClient({
      blockNumber: 20_000n,
      logs: [],
    });

    await queryLaunches(
      { fromBlock: 1n, toBlock: 5_000n, chunkSize: 2_000n },
      { client, debug: silentDebug, defaultChunkSize: 2_000n },
    );

    expect(client.getLogsCalls.map((call) => [call.fromBlock, call.toBlock])).toEqual([
      [1n, 2_000n],
      [2_001n, 4_000n],
      [4_001n, 5_000n],
    ]);
    expect(client.getLogsCalls.every((call) => call.address === PONS_CONTRACTS.v1.factory)).toBe(
      true,
    );
  });

  it("resolves toBlock latest against the current chain head", async () => {
    const client = createMockPublicClient({
      blockNumber: 250n,
      logs: [],
    });

    await queryLaunches(
      { fromBlock: 1n, toBlock: "latest", chunkSize: 100n },
      { client, debug: silentDebug, defaultChunkSize: 100n },
    );

    expect(client.getLogsCalls.at(-1)?.toBlock).toBe(250n);
  });

  it("deduplicates overlapping ranges and sorts deterministically", () => {
    const first = decodeTokenLaunched(v1Fixture.log);
    const later = decodeTokenLaunched(
      shiftLog(v1Fixture.log, {
        blockNumber: "0x88c44f",
        transactionHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        transactionIndex: "0x1",
        logIndex: "0x1",
      }),
    );
    const sameAsFirst = decodeTokenLaunched(v1Fixture.log);
    const sameBlockEarlierIndex = decodeTokenLaunched(
      shiftLog(v1Fixture.log, {
        transactionHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        transactionIndex: "0x2",
        logIndex: "0x1",
      }),
    );

    const merged = dedupeAndSortLaunches([later, sameAsFirst, first, sameBlockEarlierIndex]);

    expect(merged).toHaveLength(3);
    expect(
      merged.map((launch) => [launch.blockNumber, launch.transactionIndex, launch.logIndex]),
    ).toEqual([
      [first.blockNumber, 2n, 1n],
      [first.blockNumber, first.transactionIndex, first.logIndex],
      [later.blockNumber, later.transactionIndex, later.logIndex],
    ]);
  });

  it("applies indexed token and deployer filters", async () => {
    const token = getAddress("0x39dbed3a2bd333467115de45665cc57f813c4571");
    const deployer = getAddress("0xb9f5f4ea1af1f5d3678470eb98e8fbdcadeb24b0");
    const client = createMockPublicClient({ logs: [] });

    await queryLaunches(
      { fromBlock: 1n, toBlock: 10n, token, deployer },
      { client, debug: silentDebug, defaultChunkSize: 2_000n },
    );

    expect(client.getLogsCalls[0]?.args).toEqual({ token, deployer });
  });

  it("wraps RPC failures with block-range context", async () => {
    const client = createMockPublicClient({
      getLogsError: new Error("range too large"),
    });

    const error = await queryLaunches(
      { fromBlock: 100n, toBlock: 200n },
      { client, debug: silentDebug, defaultChunkSize: 2_000n },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PonsRpcError);
    expect(error).toMatchObject({
      operation: "getTokenLaunchedLogs",
      chainId: 4663,
      fromBlock: 100n,
      toBlock: 200n,
    });
    expect((error as PonsRpcError).message).toMatch(/range too large/);
  });
});

describe("queryLaunch", () => {
  it("returns a typed V1 launched token when the factory record exists", async () => {
    const token = getAddress("0x39dbed3a2bd333467115de45665cc57f813c4571");
    const client = createMockPublicClient({
      readContract: (() =>
        Promise.resolve({
          token,
          deployer: getAddress("0xb9f5f4ea1af1f5d3678470eb98e8fbdcadeb24b0"),
          pairedToken: getAddress("0x0bd7d308f8e1639fab988df18a8011f41eacad73"),
          positionManager: getAddress("0x73991a25c818bf1f1128deaab1492d45638de0d3"),
          positionId: 109216n,
          dexId: 0n,
          launchConfigId: 0n,
          restrictionsEndBlock: 25_526_532n,
          supply: 1_000_000_000_000_000_000_000_000_000n,
          isToken0: false,
          poolFee: 10_000,
          exists: true,
          initialBuyAmount: 100_000_000_000_000_000n,
        })) as PonsPublicClient["readContract"],
    });

    const launch = await queryLaunch(token, { version: "v1" }, { client, debug: silentDebug });

    expect(launch.version).toBe("v1");
    expect(launch.exists).toBe(true);
    expect(launch.token).toBe(token);
  });

  it("fails loudly when the token is not on the requested factory", async () => {
    const client = createMockPublicClient({
      readContract: (() =>
        Promise.resolve({
          token: "0x0000000000000000000000000000000000000000",
          deployer: "0x0000000000000000000000000000000000000000",
          pairedToken: "0x0000000000000000000000000000000000000000",
          positionManager: "0x0000000000000000000000000000000000000000",
          positionId: 0n,
          dexId: 0n,
          launchConfigId: 0n,
          restrictionsEndBlock: 0n,
          supply: 0n,
          isToken0: false,
          poolFee: 0,
          exists: false,
          initialBuyAmount: 0n,
        })) as PonsPublicClient["readContract"],
    });

    await expect(
      queryLaunch(
        PONS_CONTRACTS.v1.factory,
        { version: "v1", includeLegacy: false },
        { client, debug: silentDebug },
      ),
    ).rejects.toBeInstanceOf(PonsContractError);
  });
});

describe("V1 launch metadata", () => {
  it("preserves raw blockchain values on decoded launches", () => {
    const launch = decodeTokenLaunched(v1Fixture.log) as PonsV1Launch;

    expect(typeof launch.initialBuyAmount).toBe("bigint");
    expect(Number.isInteger(Number(launch.initialBuyAmount))).toBe(true);
    expect(launch.initialBuyAmount).not.toBe(0.1);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { decodeTokenLaunched } from "../../src/events/decodeTokenLaunched.js";
import { PonsIndexer } from "../../src/indexer/PonsIndexer.js";
import { PONS_TOKEN_LAUNCHED_STATE_NAME } from "../../src/indexer/types.js";
import { PonsDatabase } from "../../src/storage/Database.js";
import { PonsConfigError } from "../../src/errors/PonsError.js";
import type { GetLaunchesParams, PonsLaunch } from "../../src/types/launch.js";
import v1Fixture from "../fixtures/tokenLaunched.v1.json" with { type: "json" };
import v2Fixture from "../fixtures/tokenLaunched.v2.json" with { type: "json" };
import { createMockLaunchSource } from "../helpers/mockLaunchSource.js";

const v1Launch = decodeTokenLaunched(v1Fixture.log);
const v2Launch = decodeTokenLaunched(v2Fixture.log);

const laterV1Launch: PonsLaunch = {
  ...v1Launch,
  logIndex: v1Launch.logIndex + 1n,
  blockNumber: v1Launch.blockNumber + 20n,
  transactionHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};

function createIndexer(
  launches: PonsLaunch[],
  options: {
    chunkSize?: bigint;
    getLaunchesError?: Error | ((params: { fromBlock: bigint }) => Error | undefined);
  } = {},
) {
  const database = new PonsDatabase(":memory:");
  const client = createMockLaunchSource({
    launches,
    blockNumber: laterV1Launch.blockNumber + 100n,
    getLaunchesError: options.getLaunchesError,
  });
  const indexer = new PonsIndexer({
    client,
    database,
    chunkSize: options.chunkSize ?? 2_000n,
  });
  return { database, client, indexer };
}

describe("PonsIndexer", () => {
  const databases: PonsDatabase[] = [];

  afterEach(() => {
    for (const database of databases) {
      database.close();
    }
    databases.length = 0;
  });

  function trackedIndexer(
    launches: PonsLaunch[],
    options?: {
      chunkSize?: bigint;
      getLaunchesError?: Error | ((params: { fromBlock: bigint }) => Error | undefined);
    },
  ) {
    const created = createIndexer(launches, options);
    databases.push(created.database);
    return created;
  }

  it("syncs an empty range without inserting rows", async () => {
    const { indexer } = trackedIndexer([]);
    const result = await indexer.sync({
      fromBlock: 8_963_000n,
      toBlock: 8_963_010n,
    });

    expect(result.found).toBe(0);
    expect(result.inserted).toBe(0);
    expect(indexer.countLaunches()).toBe(0);
    expect(indexer.getSyncStatus().lastProcessedBlock).toBe(8_963_010n);
  });

  it("indexes a range containing launches", async () => {
    const { indexer } = trackedIndexer([v1Launch, v2Launch], { chunkSize: 100_000_000n });
    const result = await indexer.sync({
      fromBlock: v1Launch.blockNumber,
      toBlock: v2Launch.blockNumber,
    });

    expect(result.found).toBe(2);
    expect(result.inserted).toBe(2);
    expect(indexer.countLaunches()).toBe(2);
    expect(indexer.getLaunch(v1Launch.token)?.version).toBe("v1");
    expect(indexer.getLaunch(v2Launch.token)?.version).toBe("v2");
  });

  it("syncs across multiple chunks", async () => {
    const { indexer, client } = trackedIndexer([v1Launch, laterV1Launch], { chunkSize: 10n });
    const result = await indexer.sync({
      fromBlock: v1Launch.blockNumber,
      toBlock: laterV1Launch.blockNumber,
    });

    expect(result.chunks).toBeGreaterThan(1);
    expect(indexer.countLaunches()).toBe(2);
    expect(client.getLaunches.mock.calls.length).toBe(result.chunks);
  });

  it("does not create duplicates when the same range is synced twice", async () => {
    const { indexer } = trackedIndexer([v1Launch]);
    const params = { fromBlock: v1Launch.blockNumber, toBlock: v1Launch.blockNumber };

    const first = await indexer.sync(params);
    const second = await indexer.sync(params);

    expect(first.inserted).toBe(1);
    expect(second.found).toBe(1);
    expect(second.inserted).toBe(0);
    expect(indexer.countLaunches()).toBe(1);
  });

  it("advances the cursor after a successful chunk", async () => {
    const { indexer } = trackedIndexer([v1Launch]);
    await indexer.sync({
      fromBlock: v1Launch.blockNumber,
      toBlock: v1Launch.blockNumber + 5n,
    });

    const status = indexer.getSyncStatus();
    expect(status.name).toBe(PONS_TOKEN_LAUNCHED_STATE_NAME);
    expect(status.lastProcessedBlock).toBe(v1Launch.blockNumber + 5n);
  });

  it("does not advance the cursor when persistence fails", async () => {
    const { indexer, database } = trackedIndexer([v1Launch]);
    database.sqlite.exec(`
      CREATE TRIGGER fail_insert BEFORE INSERT ON launches
      BEGIN
        SELECT RAISE(FAIL, 'persist failed');
      END;
    `);

    await expect(
      indexer.sync({
        fromBlock: v1Launch.blockNumber,
        toBlock: v1Launch.blockNumber,
      }),
    ).rejects.toThrow(/persist failed/);

    expect(indexer.getSyncStatus().lastProcessedBlock).toBeNull();
    expect(indexer.countLaunches()).toBe(0);
  });

  it("does not advance the cursor when fetching a later chunk fails", async () => {
    const { indexer } = trackedIndexer([v1Launch, laterV1Launch], {
      chunkSize: 10n,
      getLaunchesError: (params) =>
        params.fromBlock > v1Launch.blockNumber ? new Error("rpc failed") : undefined,
    });

    await expect(
      indexer.sync({
        fromBlock: v1Launch.blockNumber,
        toBlock: laterV1Launch.blockNumber,
      }),
    ).rejects.toThrow(/rpc failed/);

    expect(indexer.getSyncStatus().lastProcessedBlock).toBe(v1Launch.blockNumber + 9n);
    expect(indexer.countLaunches()).toBe(1);
  });

  it("resumes from the last successful block after a failure", async () => {
    const { indexer, client } = trackedIndexer([v1Launch, laterV1Launch], {
      chunkSize: 10n,
      getLaunchesError: (params) =>
        params.fromBlock > v1Launch.blockNumber ? new Error("rpc failed") : undefined,
    });

    await expect(
      indexer.sync({
        fromBlock: v1Launch.blockNumber,
        toBlock: laterV1Launch.blockNumber,
      }),
    ).rejects.toThrow(/rpc failed/);

    client.getLaunches.mockImplementation((params: GetLaunchesParams) => {
      const toBlock =
        typeof params.toBlock === "bigint" ? params.toBlock : laterV1Launch.blockNumber;
      return Promise.resolve(
        [v1Launch, laterV1Launch].filter(
          (launch) => launch.blockNumber >= params.fromBlock && launch.blockNumber <= toBlock,
        ),
      );
    });

    const resumed = await indexer.sync({
      toBlock: laterV1Launch.blockNumber,
    });

    expect(resumed.fromBlock).toBe(v1Launch.blockNumber + 10n);
    expect(indexer.countLaunches()).toBe(2);
    expect(indexer.getSyncStatus().lastProcessedBlock).toBe(laterV1Launch.blockNumber);
  });

  it("returns launches in deterministic block order, not insertion order", async () => {
    const { indexer } = trackedIndexer([laterV1Launch, v1Launch]);
    await indexer.sync({
      fromBlock: v1Launch.blockNumber,
      toBlock: laterV1Launch.blockNumber,
    });

    const launches = indexer.getLaunches();
    expect(launches.map((launch) => launch.blockNumber)).toEqual([
      v1Launch.blockNumber.toString(),
      laterV1Launch.blockNumber.toString(),
    ]);

    const latest = indexer.getLatestLaunches(2);
    expect(latest.map((launch) => launch.blockNumber)).toEqual([
      laterV1Launch.blockNumber.toString(),
      v1Launch.blockNumber.toString(),
    ]);
  });

  it("stores V1 and V2 fields without collapsing them", async () => {
    const { indexer } = trackedIndexer([v1Launch, v2Launch], { chunkSize: 100_000_000n });
    await indexer.sync({
      fromBlock: v1Launch.blockNumber,
      toBlock: v2Launch.blockNumber,
    });

    const storedV1 = indexer.getLaunch(v1Launch.token);
    const storedV2 = indexer.getLaunch(v2Launch.token);

    expect(storedV1?.version).toBe("v1");
    expect(storedV1?.pool).toBe(v1Launch.version === "v1" ? v1Launch.pool : null);
    expect(storedV1?.positionId).toBe("109216");
    expect(storedV1?.initialBuyAmount).toBe("100000000000000000");
    expect(storedV2?.version).toBe("v2");
    expect(storedV2?.curve).toBe(v2Launch.version === "v2" ? v2Launch.curve : null);
    expect(storedV2?.pool).toBeNull();
    expect(storedV2?.graduationThreshold).toBe("4200000000000000000");
  });

  it("resolves timestamps once per unique block", async () => {
    const sameBlockLaunch: PonsLaunch = {
      ...v1Launch,
      logIndex: v1Launch.logIndex + 7n,
      transactionHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    };
    const { indexer, client } = trackedIndexer([v1Launch, sameBlockLaunch]);
    await indexer.sync({
      fromBlock: v1Launch.blockNumber,
      toBlock: v1Launch.blockNumber,
    });

    expect(client.getBlockTimestamp.mock.calls).toHaveLength(1);
    expect(indexer.getLaunch(v1Launch.token)?.timestamp).toBe(
      (v1Launch.blockNumber * 12n).toString(),
    );
  });

  it("requires fromBlock on the first sync", async () => {
    const { indexer } = trackedIndexer([]);
    await expect(indexer.sync({ toBlock: 10n })).rejects.toBeInstanceOf(PonsConfigError);
  });

  it("filters persisted launches", async () => {
    const { indexer } = trackedIndexer([v1Launch, v2Launch], { chunkSize: 100_000_000n });
    await indexer.sync({
      fromBlock: v1Launch.blockNumber,
      toBlock: v2Launch.blockNumber,
    });

    expect(indexer.countLaunches({ version: "v1" })).toBe(1);
    expect(indexer.getLaunches({ deployer: v1Launch.deployer, limit: 10 })[0]?.token).toBe(
      v1Launch.token,
    );
    expect(
      indexer.getLaunches({ pool: v1Launch.version === "v1" ? v1Launch.pool : "0x" }),
    ).toHaveLength(1);
  });
});

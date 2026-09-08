import { afterEach, describe, expect, it } from "vitest";
import { PonsClient } from "../../src/client/PonsClient.js";
import { PONS_REFERENCE } from "../../src/contracts/addresses.js";
import { PonsIndexer } from "../../src/indexer/PonsIndexer.js";
import { PonsDatabase } from "../../src/storage/Database.js";

const KNOWN_LAUNCH_BLOCK = 8_963_150n;

describe("PonsIndexer integration", () => {
  const databases: PonsDatabase[] = [];

  afterEach(() => {
    for (const database of databases) {
      database.close();
    }
    databases.length = 0;
  });

  it("indexes the verified V1 PONS launch and ignores a replay of the same range", async () => {
    const database = new PonsDatabase(":memory:");
    databases.push(database);

    const indexer = new PonsIndexer({
      client: new PonsClient(),
      database,
      version: "v1",
      includeLegacy: true,
    });

    const first = await indexer.sync({
      fromBlock: KNOWN_LAUNCH_BLOCK,
      toBlock: KNOWN_LAUNCH_BLOCK,
    });

    const stored = indexer.getLaunch(PONS_REFERENCE.token);
    expect(first.inserted).toBe(1);
    expect(indexer.countLaunches()).toBe(1);
    expect(stored?.version).toBe("v1");
    expect(stored?.token).toBe(PONS_REFERENCE.token);
    expect(stored?.transactionHash).toBe(PONS_REFERENCE.launchTx);
    expect(stored?.blockNumber).toBe(KNOWN_LAUNCH_BLOCK.toString());
    expect(stored?.logIndex).toBe("45");
    expect(stored?.positionId).toBe("109216");
    expect(stored?.initialBuyAmount).toBe("100000000000000000");
    expect(stored?.timestamp).not.toBeNull();

    const second = await indexer.sync({
      fromBlock: KNOWN_LAUNCH_BLOCK,
      toBlock: KNOWN_LAUNCH_BLOCK,
    });

    expect(second.inserted).toBe(0);
    expect(indexer.countLaunches()).toBe(1);
    expect(
      indexer.getLaunches().map((launch) => `${launch.transactionHash}:${launch.logIndex}`),
    ).toEqual([`${PONS_REFERENCE.launchTx}:45`]);
  }, 60_000);
});

import { afterEach, describe, expect, it } from "vitest";
import { decodeTokenLaunched } from "../../src/events/decodeTokenLaunched.js";
import { PonsDatabase } from "../../src/storage/Database.js";
import { LaunchRepository } from "../../src/storage/repositories/LaunchRepository.js";
import v1Fixture from "../fixtures/tokenLaunched.v1.json" with { type: "json" };

const v1Launch = decodeTokenLaunched(v1Fixture.log);

describe("PonsDatabase", () => {
  const databases: PonsDatabase[] = [];

  afterEach(() => {
    for (const database of databases) {
      database.close();
    }
    databases.length = 0;
  });

  function open(): PonsDatabase {
    const database = new PonsDatabase(":memory:");
    databases.push(database);
    return database;
  }

  it("enforces unique transaction hash and log index", () => {
    const database = open();
    const row = {
      version: "v1",
      token_address: v1Launch.token,
      deployer: v1Launch.deployer,
      factory: v1Launch.factory,
      block_number: v1Launch.blockNumber.toString(),
      transaction_hash: v1Launch.transactionHash.toLowerCase(),
      log_index: v1Launch.logIndex.toString(),
      created_at: "2026-01-01T00:00:00.000Z",
    };

    const insert = database.sqlite.prepare(
      `
      INSERT INTO launches (
        version, token_address, deployer, factory, block_number, transaction_hash, log_index, created_at
      ) VALUES (
        @version, @token_address, @deployer, @factory, @block_number, @transaction_hash, @log_index, @created_at
      )
      `,
    );

    insert.run(row);
    expect(() => insert.run(row)).toThrow(/UNIQUE/);
  });

  it("stores blockchain quantities as exact decimal strings", () => {
    const database = open();
    const repository = new LaunchRepository(database);
    const timestamps = new Map<string, bigint>([[v1Launch.blockNumber.toString(), 1_700_000_000n]]);

    repository.insertLaunches([v1Launch], timestamps);

    const stored = repository.getLaunch(v1Launch.token);
    expect(stored?.initialBuyAmount).toBe("100000000000000000");
    expect(stored?.positionId).toBe("109216");
    expect(stored?.blockNumber).toBe("8963150");
    expect(stored?.timestamp).toBe("1700000000");
    expect(typeof stored?.initialBuyAmount).toBe("string");
    expect(BigInt(stored?.initialBuyAmount ?? "0")).toBe(
      v1Launch.version === "v1" ? v1Launch.initialBuyAmount : 0n,
    );
  });

  it("rolls back launches and cursor updates in the same transaction", () => {
    const database = open();
    const repository = new LaunchRepository(database);

    expect(() =>
      database.transaction(() => {
        repository.insertLaunches([v1Launch], new Map());
        database.sqlite
          .prepare("INSERT INTO indexer_state (name, last_processed_block) VALUES (?, ?)")
          .run("pons-token-launched-v1-v2", v1Launch.blockNumber.toString());
        throw new Error("commit failed");
      }),
    ).toThrow(/commit failed/);

    expect(repository.countLaunches()).toBe(0);
    const state = database.sqlite.prepare("SELECT COUNT(*) AS count FROM indexer_state").get() as {
      count: number;
    };
    expect(state.count).toBe(0);
  });

  it("ignores duplicate inserts through the repository", () => {
    const database = open();
    const repository = new LaunchRepository(database);

    expect(repository.insertLaunches([v1Launch], new Map())).toBe(1);
    expect(repository.insertLaunches([v1Launch], new Map())).toBe(0);
    expect(repository.countLaunches()).toBe(1);
  });
});

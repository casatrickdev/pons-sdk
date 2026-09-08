import { describe, expect, it } from "vitest";
import { decodeTokenLaunched, launchIdentity } from "../../src/events/decodeTokenLaunched.js";
import { launchEventIdentity, uniqueLaunches } from "../../src/indexer/dedupe.js";
import v1Fixture from "../fixtures/tokenLaunched.v1.json" with { type: "json" };

describe("indexer dedupe", () => {
  it("identifies a launch by transaction hash and log index", () => {
    const launch = decodeTokenLaunched(v1Fixture.log);

    expect(launchEventIdentity(launch.transactionHash, launch.logIndex)).toBe(
      launchIdentity(launch),
    );
    expect(
      launchEventIdentity(launch.transactionHash.toUpperCase(), launch.logIndex.toString()),
    ).toBe(`${launch.transactionHash.toLowerCase()}:${launch.logIndex.toString()}`);
  });

  it("drops duplicate identities while preserving the first copy", () => {
    const launch = decodeTokenLaunched(v1Fixture.log);
    const unique = uniqueLaunches([launch, { ...launch }, launch]);

    expect(unique).toHaveLength(1);
    expect(unique[0]).toBe(launch);
  });
});

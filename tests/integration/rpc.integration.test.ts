import { describe, expect, it } from "vitest";
import { PonsClient } from "../../src/client/PonsClient.js";
import { ROBINHOOD_CHAIN_ID } from "../../src/chain/robinhoodChain.js";
import { PONS_CONTRACTS, PONS_REFERENCE } from "../../src/contracts/addresses.js";

describe("Robinhood Chain integration", () => {
  it("connects to the public RPC and reads the latest block", async () => {
    const pons = new PonsClient();
    const blockNumber = await pons.getBlockNumber();

    expect(pons.chainId).toBe(ROBINHOOD_CHAIN_ID);
    expect(blockNumber).toBeGreaterThan(0n);
  });

  it("reads the official PONS reference token from the V1 legacy factory", async () => {
    const pons = new PonsClient();
    const launch = await pons.getLaunch(PONS_REFERENCE.token, {
      version: "v1",
      includeLegacy: true,
    });

    expect(launch.version).toBe("v1");
    expect(launch.exists).toBe(true);
    expect(launch.token).toBe(PONS_REFERENCE.token);
    expect(launch.factory).toBe(PONS_CONTRACTS.v1.legacy.factory);
  });

  it("reads a verified V2 factory view without sending a transaction", async () => {
    const pons = new PonsClient();
    const canLaunch = await pons.canLaunch(PONS_CONTRACTS.v2.factory);

    expect(typeof canLaunch).toBe("boolean");
  });
});

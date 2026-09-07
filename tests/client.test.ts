import { getAddress, zeroAddress } from "viem";
import { describe, expect, it } from "vitest";
import { PonsClient } from "../src/client/PonsClient.js";
import { ROBINHOOD_CHAIN_ID, ROBINHOOD_CHAIN_RPC_URL } from "../src/chain/robinhoodChain.js";
import { PONS_CONTRACTS, PONS_REFERENCE } from "../src/contracts/addresses.js";
import { PonsConfigError } from "../src/errors/PonsError.js";
import { requireAddress } from "../src/validation/address.js";

describe("PonsClient configuration", () => {
  it("defaults to Robinhood Chain and the public RPC", () => {
    const client = new PonsClient();

    expect(client.chainId).toBe(ROBINHOOD_CHAIN_ID);
    expect(client.rpcUrl).toBe(ROBINHOOD_CHAIN_RPC_URL);
  });

  it("accepts a custom RPC URL", () => {
    const rpcUrl = "https://rpc.example.com/robinhood";
    const client = new PonsClient({ rpcUrl });

    expect(client.chainId).toBe(ROBINHOOD_CHAIN_ID);
    expect(client.rpcUrl).toBe(rpcUrl);
  });

  it("rejects an empty RPC URL", () => {
    expect(() => new PonsClient({ rpcUrl: "   " })).toThrow(PonsConfigError);
    expect(() => new PonsClient({ rpcUrl: "   " })).toThrow(/rpcUrl must be a non-empty string/);
  });

  it("rejects a non-HTTP RPC URL", () => {
    expect(() => new PonsClient({ rpcUrl: "ftp://rpc.example.com" })).toThrow(PonsConfigError);
  });

  it("rejects a malformed RPC URL", () => {
    expect(() => new PonsClient({ rpcUrl: "not-a-url" })).toThrow(PonsConfigError);
  });

  it("rejects a non-positive default chunk size", () => {
    expect(() => new PonsClient({ defaultChunkSize: 0n })).toThrow(PonsConfigError);
    expect(() => new PonsClient({ defaultChunkSize: -10n })).toThrow(PonsConfigError);
  });
});

describe("address handling", () => {
  it("accepts and checksums valid addresses", () => {
    const raw = PONS_REFERENCE.token.toLowerCase();
    expect(requireAddress(raw, "token")).toBe(getAddress(PONS_REFERENCE.token));
    expect(requireAddress(zeroAddress, "zero")).toBe(zeroAddress);
    expect(requireAddress(PONS_CONTRACTS.v1.factory, "factory")).toBe(PONS_CONTRACTS.v1.factory);
  });

  it("rejects invalid addresses", () => {
    expect(() => requireAddress("0x123", "token")).toThrow(PonsConfigError);
    expect(() => requireAddress("not-an-address", "deployer")).toThrow(PonsConfigError);
    expect(() => requireAddress("0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ", "pool")).toThrow(
      PonsConfigError,
    );
  });

  it("rejects invalid filter addresses on getLaunches", async () => {
    const client = new PonsClient();

    await expect(
      client.getLaunches({
        fromBlock: 1n,
        toBlock: 2n,
        token: "0x123",
      }),
    ).rejects.toBeInstanceOf(PonsConfigError);
  });
});

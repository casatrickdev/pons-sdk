import { getAddress, zeroAddress } from "viem";
import { describe, expect, it } from "vitest";
import {
  PONS_V1_TOKEN_LAUNCHED_TOPIC,
  PONS_V2_TOKEN_LAUNCHED_TOPIC,
} from "../src/contracts/abis.js";
import { PONS_CONTRACTS, PONS_REFERENCE, PONS_WETH } from "../src/contracts/addresses.js";
import { decodeTokenLaunched } from "../src/events/decodeTokenLaunched.js";
import { PonsContractError } from "../src/errors/PonsError.js";
import type { TokenLaunchedLogInput } from "../src/types/event.js";
import v1Fixture from "./fixtures/tokenLaunched.v1.json" with { type: "json" };
import v2Fixture from "./fixtures/tokenLaunched.v2.json" with { type: "json" };

describe("TokenLaunched event topics", () => {
  it("matches the official V1 topic0", () => {
    expect(PONS_V1_TOKEN_LAUNCHED_TOPIC).toBe(
      "0xdb51ea9ad51ab453a65a4cb7e60c3cb378c9501bb002609f8f97778fb6c4235a",
    );
  });

  it("matches the official V2 topic0", () => {
    expect(PONS_V2_TOKEN_LAUNCHED_TOPIC).toBe(
      "0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607",
    );
  });
});

describe("decodeTokenLaunched", () => {
  it("decodes the official V1 PONS reference TokenLaunched log", () => {
    const launch = decodeTokenLaunched(v1Fixture.log);

    expect(launch.version).toBe("v1");
    if (launch.version !== "v1") {
      return;
    }

    expect(launch.factory).toBe(PONS_CONTRACTS.v1.legacy.factory);
    expect(launch.token).toBe(PONS_REFERENCE.token);
    expect(launch.deployer).toBe(getAddress("0xb9f5f4ea1af1f5d3678470eb98e8fbdcadeb24b0"));
    expect(launch.dexFactory).toBe(getAddress("0x1f7d7550b1b028f7571e69a784071f0205fd2efa"));
    expect(launch.pairToken).toBe(PONS_WETH);
    expect(launch.pool).toBe(PONS_REFERENCE.pool);
    expect(launch.dexId).toBe(0n);
    expect(launch.launchConfigId).toBe(0n);
    expect(launch.positionId).toBe(109216n);
    expect(launch.restrictionsEndBlock).toBe(25_526_532n);
    expect(launch.initialBuyAmount).toBe(100_000_000_000_000_000n);
    expect(launch.blockNumber).toBe(8_963_150n);
    expect(launch.transactionHash).toBe(PONS_REFERENCE.launchTx);
    expect(launch.transactionIndex).toBe(8n);
    expect(launch.logIndex).toBe(45n);
  });

  it("decodes a real V2 TokenLaunched log", () => {
    const launch = decodeTokenLaunched(v2Fixture.log);

    expect(launch.version).toBe("v2");
    if (launch.version !== "v2") {
      return;
    }

    expect(launch.factory).toBe(PONS_CONTRACTS.v2.factory);
    expect(launch.token).toBe(getAddress("0xd79cf52064e226e888780643fa219ac9f8058678"));
    expect(launch.curve).toBe(getAddress("0xb43601ab09865cb9e79df22fdee5d277f0662e10"));
    expect(launch.deployer).toBe(getAddress("0x1e22c0e86399837d5c07a39eafe62e3581ab6503"));
    expect(launch.pairToken).toBe(zeroAddress);
    expect(launch.launchConfigId).toBe(0n);
    expect(launch.graduationThreshold).toBe(4_200_000_000_000_000_000n);
    expect(launch.blockNumber).toBe(BigInt(v2Fixture.log.blockNumber));
    expect(launch.transactionHash).toBe(v2Fixture.log.transactionHash);
    expect(launch.transactionIndex).toBe(7n);
    expect(launch.logIndex).toBe(32n);
  });

  it("rejects a log with no topics", () => {
    const log: TokenLaunchedLogInput = {
      address: PONS_CONTRACTS.v1.factory,
      topics: [],
      data: "0x",
      blockNumber: 1n,
      transactionHash: PONS_REFERENCE.launchTx,
      transactionIndex: 0n,
      logIndex: 0n,
    };

    expect(() => decodeTokenLaunched(log)).toThrow(PonsContractError);
  });

  it("rejects a log with truncated V1 data", () => {
    const log: TokenLaunchedLogInput = {
      ...v1Fixture.log,
      data: "0x0000000000000000000000000bd7d308f8e1639fab988df18a8011f41eacad73",
    };

    expect(() => decodeTokenLaunched(log)).toThrow(PonsContractError);
  });

  it("rejects a log with an unknown topic0", () => {
    const log: TokenLaunchedLogInput = {
      ...v1Fixture.log,
      address: "0x0000000000000000000000000000000000000001",
      topics: [
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        ...v1Fixture.log.topics.slice(1),
      ],
    };

    expect(() => decodeTokenLaunched(log)).toThrow(
      /Unable to determine TokenLaunched event version/,
    );
  });

  it("rejects a log missing transaction metadata", () => {
    const log: TokenLaunchedLogInput = {
      address: v1Fixture.log.address,
      topics: v1Fixture.log.topics,
      data: v1Fixture.log.data,
      blockNumber: v1Fixture.log.blockNumber,
    };

    expect(() => decodeTokenLaunched(log)).toThrow(PonsContractError);
  });
});

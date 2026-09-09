import { describe, expect, it } from "vitest";
import { PonsClient } from "../../src/client/PonsClient.js";
import { CopyTradeEngine } from "../../src/copyTrading/CopyTradeEngine.js";
import { PONS_REFERENCE } from "../../src/contracts/addresses.js";
import {
  NoopExecutionAdapter,
  RESEARCH_EXECUTION_DISABLED,
} from "../../src/execution/NoopExecutionAdapter.js";
import { syntheticBuyActivity } from "../fixtures/walletActivity.synthetic.js";

describe("Copy-trading research integration", () => {
  it("reads live Pons data and evaluates a synthetic signal without executing", async () => {
    const pons = new PonsClient();
    const launch = await pons.getLaunch(PONS_REFERENCE.token, {
      version: "v1",
      includeLegacy: true,
    });
    expect(launch.exists).toBe(true);

    const engine = new CopyTradeEngine({
      mode: "research",
      policy: {
        allowedTokens: [launch.token],
        minTradeSize: 1n,
      },
      executionAdapter: new NoopExecutionAdapter(),
    });

    const signal = engine.process({
      ...syntheticBuyActivity,
      token: launch.token,
    });

    expect(signal.token).toBe(launch.token);
    expect(signal.status).toBe("approved");
    expect(engine.explain(signal)).toContain("token allowed");

    const preview = await engine.previewExecution(signal);
    expect(preview.status).toBe("not_executed");
    expect(preview.reason).toBe(RESEARCH_EXECUTION_DISABLED);
    await expect(engine.execute(signal)).rejects.toThrow(/Live execution is disabled/);
  }, 60_000);
});

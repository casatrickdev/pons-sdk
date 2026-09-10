import { describe, expect, it } from "vitest";
import { PONS_REFERENCE } from "../../src/contracts/addresses.js";
import { CopyTradeEngine, LIVE_EXECUTION_DISABLED } from "../../src/copyTrading/CopyTradeEngine.js";
import { RiskEvaluator } from "../../src/copyTrading/RiskEvaluator.js";
import { SignalBuilder } from "../../src/copyTrading/SignalBuilder.js";
import { TradeDetector } from "../../src/copyTrading/TradeDetector.js";
import { TradeFilter } from "../../src/copyTrading/TradeFilter.js";
import { copyTradeSignalId } from "../../src/copyTrading/types.js";
import { PonsError } from "../../src/errors/PonsError.js";
import {
  NoopExecutionAdapter,
  RESEARCH_EXECUTION_DISABLED,
} from "../../src/execution/NoopExecutionAdapter.js";
import { buildWalletState } from "../../src/wallets/WalletState.js";
import {
  SYNTHETIC_WATCHED_WALLET,
  syntheticBuyActivity,
  syntheticSellActivity,
} from "../fixtures/synthetic-wallet-activity.js";

const detector = new TradeDetector();

describe("TradeDetector", () => {
  it("detects a synthetic buy candidate", () => {
    const detection = detector.detect(syntheticBuyActivity);
    expect(detection.supported).toBe(true);
    expect(detection.candidate?.side).toBe("buy");
    expect(detection.reasons).toEqual(["valid trade"]);
  });

  it("detects a synthetic sell candidate", () => {
    const detection = detector.detect(syntheticSellActivity);
    expect(detection.candidate?.side).toBe("sell");
  });

  it("rejects unsupported activity", () => {
    const detection = detector.detect({
      ...syntheticBuyActivity,
      source: "indexer",
    });
    expect(detection.supported).toBe(false);
    expect(detection.reasons[0]).toMatch(/Unsupported wallet activity source/);
  });

  it("rejects malformed activity", () => {
    const detection = detector.detect({
      ...syntheticBuyActivity,
      transactionHash: "0x1234",
    });
    expect(detection.supported).toBe(false);
    expect(detection.reasons[0]).toMatch(/transactionHash/);
  });
});

describe("TradeFilter", () => {
  it("approves an allowlisted wallet", () => {
    const filter = new TradeFilter({ allowedWallets: [SYNTHETIC_WATCHED_WALLET] });
    const candidate = detector.detect(syntheticBuyActivity).candidate;
    expect(candidate).toBeDefined();
    if (candidate === undefined) {
      return;
    }
    expect(filter.evaluate(candidate)).toEqual({
      approved: true,
      reasons: ["wallet allowed"],
    });
  });

  it("rejects a wallet that is not allowlisted", () => {
    const filter = new TradeFilter({
      allowedWallets: ["0x0000000000000000000000000000000000000001"],
    });
    const candidate = detector.detect(syntheticBuyActivity).candidate;
    expect(candidate).toBeDefined();
    if (candidate === undefined) {
      return;
    }
    expect(filter.evaluate(candidate).reasons).toContain("wallet not allowlisted");
  });

  it("approves an allowed token", () => {
    const filter = new TradeFilter({ allowedTokens: [PONS_REFERENCE.token] });
    const candidate = detector.detect(syntheticBuyActivity).candidate;
    expect(candidate).toBeDefined();
    if (candidate === undefined) {
      return;
    }
    expect(filter.evaluate(candidate)).toEqual({
      approved: true,
      reasons: ["token allowed"],
    });
  });

  it("rejects an excluded token", () => {
    const filter = new TradeFilter({ excludedTokens: [PONS_REFERENCE.token] });
    const candidate = detector.detect(syntheticBuyActivity).candidate;
    expect(candidate).toBeDefined();
    if (candidate === undefined) {
      return;
    }
    expect(filter.evaluate(candidate).reasons).toContain("token excluded");
  });

  it("rejects trades below the minimum size", () => {
    const filter = new TradeFilter({ minTradeSize: 1_000_000_000_000_000_000n });
    const candidate = detector.detect(syntheticBuyActivity).candidate;
    expect(candidate).toBeDefined();
    if (candidate === undefined) {
      return;
    }
    expect(filter.evaluate(candidate).reasons).toContain("trade below minimum");
  });

  it("rejects trades above the maximum size", () => {
    const filter = new TradeFilter({ maxTradeSize: 1n });
    const candidate = detector.detect(syntheticBuyActivity).candidate;
    expect(candidate).toBeDefined();
    if (candidate === undefined) {
      return;
    }
    expect(filter.evaluate(candidate).reasons).toContain("trade above maximum");
  });

  it("rejects a stale signal", () => {
    const filter = new TradeFilter({ maxSignalAgeSeconds: 10 });
    const candidate = detector.detect(syntheticBuyActivity).candidate;
    expect(candidate).toBeDefined();
    if (candidate === undefined) {
      return;
    }
    expect(filter.evaluate(candidate, 1_700_000_100n).reasons).toContain("stale signal");
  });
});

describe("RiskEvaluator", () => {
  const candidate = detector.detect(syntheticBuyActivity).candidate;

  it("accepts a candidate within limits", () => {
    expect(candidate).toBeDefined();
    if (candidate === undefined) {
      return;
    }
    const decision = new RiskEvaluator({ maxPositionSize: 1_000_000_000_000_000_000n }).evaluate(
      candidate,
    );
    expect(decision.approved).toBe(true);
    expect(decision.reasons).toContain("exposure within limit");
  });

  it("rejects when max position size is exceeded", () => {
    expect(candidate).toBeDefined();
    if (candidate === undefined) {
      return;
    }
    const decision = new RiskEvaluator({ maxPositionSize: 1n }).evaluate(candidate);
    expect(decision.approved).toBe(false);
    expect(decision.reasons).toContain("notional exceeds maximum");
  });

  it("rejects when the position limit is exceeded", () => {
    expect(candidate).toBeDefined();
    if (candidate === undefined) {
      return;
    }
    const state = buildWalletState(SYNTHETIC_WATCHED_WALLET, [syntheticBuyActivity]);
    const decision = new RiskEvaluator({ maxOpenPositions: 0 }).evaluate(candidate, {
      walletState: { ...state, positions: state.positions },
    });
    expect(decision.reasons).toContain("position limit exceeded");
  });

  it("rejects a stale signal", () => {
    expect(candidate).toBeDefined();
    if (candidate === undefined) {
      return;
    }
    const decision = new RiskEvaluator({ maxSignalAgeSeconds: 10 }).evaluate(candidate, {
      nowSeconds: 1_700_000_100n,
    });
    expect(decision.reasons).toContain("stale signal");
  });

  it("rejects missing required data", () => {
    expect(candidate).toBeDefined();
    if (candidate === undefined) {
      return;
    }
    const decision = new RiskEvaluator({ maxTokenExposure: 1n }).evaluate(candidate);
    expect(decision.reasons).toContain("missing required data");
  });

  it("rejects when token exposure is exceeded", () => {
    expect(candidate).toBeDefined();
    if (candidate === undefined) {
      return;
    }
    const state = buildWalletState(SYNTHETIC_WATCHED_WALLET, [syntheticBuyActivity]);
    const decision = new RiskEvaluator({ maxTokenExposure: 1n }).evaluate(candidate, {
      walletState: state,
    });
    expect(decision.reasons).toContain("token exposure exceeded");
  });

  it("rejects when wallet exposure is exceeded", () => {
    expect(candidate).toBeDefined();
    if (candidate === undefined) {
      return;
    }
    const state = buildWalletState(SYNTHETIC_WATCHED_WALLET, [syntheticBuyActivity]);
    const decision = new RiskEvaluator({ maxWalletExposure: 1n }).evaluate(candidate, {
      walletState: state,
    });
    expect(decision.reasons).toContain("wallet exposure exceeded");
  });
});

describe("SignalBuilder", () => {
  it("builds a deterministic approved signal", () => {
    const candidate = detector.detect(syntheticBuyActivity).candidate;
    expect(candidate).toBeDefined();
    if (candidate === undefined) {
      return;
    }
    const signal = new SignalBuilder().build(
      candidate,
      { approved: true, reasons: ["wallet allowed"] },
      { approved: true, reasons: ["exposure within limit"] },
      { createdAt: "2026-01-01T00:00:00.000Z" },
    );
    expect(signal.id).toBe(
      copyTradeSignalId(syntheticBuyActivity.transactionHash, syntheticBuyActivity.logIndex),
    );
    expect(signal.status).toBe("approved");
    expect(signal.filterReasons).toEqual(["wallet allowed"]);
    expect(signal.riskReasons).toEqual(["exposure within limit"]);
    expect(signal.blockNumber).toBe(syntheticBuyActivity.blockNumber);
    expect(signal.pool).toBe(syntheticBuyActivity.pool);
  });

  it("builds a rejected signal with reasons", () => {
    const candidate = detector.detect(syntheticBuyActivity).candidate;
    expect(candidate).toBeDefined();
    if (candidate === undefined) {
      return;
    }
    const signal = new SignalBuilder().build(
      candidate,
      { approved: false, reasons: ["wallet not allowlisted"] },
      { approved: true, reasons: ["no risk constraints"] },
    );
    expect(signal.status).toBe("rejected");
    expect(signal.filterReasons).toContain("wallet not allowlisted");
  });
});

describe("CopyTradeEngine", () => {
  it("runs activity through detector, filter, risk, and signal builder", () => {
    const engine = new CopyTradeEngine({
      mode: "research",
      policy: {
        allowedWallets: [SYNTHETIC_WATCHED_WALLET],
        minTradeSize: 1n,
        maxPositionSize: 10_000_000_000_000_000_000n,
      },
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });

    const signal = engine.process(syntheticBuyActivity);
    expect(signal.status).toBe("approved");
    expect(signal.id).toBe(`${syntheticBuyActivity.transactionHash}:1`);
    expect(engine.explain(signal)).toContain("Detection");
    expect(engine.explain(signal)).toContain("valid trade");
    expect(engine.explain(signal)).toContain("Filter");
    expect(engine.explain(signal)).toContain("wallet allowed");
    expect(engine.explain(signal)).toContain("Risk");
    expect(engine.explain(signal)).toContain("Signal:\nAPPROVED");
    expect(engine.explain(signal)).toContain("Execution:\nDISABLED");
  });

  it("rejects when the filter fails", () => {
    const engine = new CopyTradeEngine({
      policy: { excludedTokens: [PONS_REFERENCE.token] },
    });
    const signal = engine.process(syntheticBuyActivity);
    expect(signal.status).toBe("rejected");
    expect(signal.filterReasons).toContain("token excluded");
    expect(engine.explain(signal)).toContain("Signal:\nREJECTED");
    expect(engine.explain(signal)).toContain("Execution:\nDISABLED");
  });

  it("refuses live mode and live execution", async () => {
    expect(() => new CopyTradeEngine({ mode: "live" })).toThrow(PonsError);
    expect(() => new CopyTradeEngine({ mode: "live" })).toThrow(LIVE_EXECUTION_DISABLED);

    const engine = new CopyTradeEngine();
    const signal = engine.process(syntheticBuyActivity);
    await expect(engine.execute(signal)).rejects.toThrow(LIVE_EXECUTION_DISABLED);
    await expect(engine.previewExecution(signal)).resolves.toEqual({
      status: "not_executed",
      reason: RESEARCH_EXECUTION_DISABLED,
    });
  });
});

describe("NoopExecutionAdapter", () => {
  it("never executes or creates a transaction", async () => {
    const engine = new CopyTradeEngine();
    const signal = engine.process(syntheticBuyActivity);
    const result = await new NoopExecutionAdapter().execute(signal);

    expect(result.status).toBe("not_executed");
    expect(result).not.toHaveProperty("transactionHash");
    expect(JSON.stringify(result)).not.toMatch(/privateKey|mnemonic|0x[a-fA-F0-9]{64}/);
    expect(engine.mode).toBe("research");
  });
});

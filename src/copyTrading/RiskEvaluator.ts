import type { CopyTradePolicy, LayerDecision, RiskContext, TradeCandidate } from "./types.js";
import { tradeSize } from "./types.js";

function parseUnixSeconds(timestamp: string | undefined): bigint | undefined {
  if (timestamp === undefined || timestamp.length === 0) {
    return undefined;
  }

  if (/^\d+$/.test(timestamp)) {
    return BigInt(timestamp);
  }

  const millis = Date.parse(timestamp);
  if (Number.isNaN(millis)) {
    return undefined;
  }
  return BigInt(Math.floor(millis / 1000));
}

export class RiskEvaluator {
  constructor(private readonly policy: CopyTradePolicy = {}) {}

  evaluate(candidate: TradeCandidate, context: RiskContext = {}): LayerDecision {
    const reasons: string[] = [];
    let approved = true;
    const size = tradeSize(candidate);

    if (this.policy.maxPositionSize !== undefined) {
      if (size === undefined) {
        approved = false;
        reasons.push("missing required data");
      } else if (size > this.policy.maxPositionSize) {
        approved = false;
        reasons.push("notional exceeds maximum");
      } else {
        reasons.push("exposure within limit");
      }
    }

    if (this.policy.maxTokenExposure !== undefined || this.policy.maxOpenPositions !== undefined) {
      const state = context.walletState;
      if (state === undefined) {
        approved = false;
        reasons.push("missing required data");
      } else {
        if (this.policy.maxOpenPositions !== undefined) {
          const open = state.positions.filter((position) => position.quantity > 0n).length;
          const nextOpen =
            candidate.side === "buy" &&
            !state.positions.some(
              (position) => position.token.toLowerCase() === candidate.token.toLowerCase(),
            )
              ? open + 1
              : open;
          if (nextOpen > this.policy.maxOpenPositions) {
            approved = false;
            reasons.push("position limit exceeded");
          }
        }

        if (this.policy.maxTokenExposure !== undefined) {
          if (candidate.amountToken === undefined && candidate.side === "buy") {
            approved = false;
            reasons.push("missing required data");
          } else {
            const current =
              state.positions.find(
                (position) => position.token.toLowerCase() === candidate.token.toLowerCase(),
              )?.quantity ?? 0n;
            const delta = candidate.amountToken ?? 0n;
            const next = candidate.side === "buy" ? current + delta : current;
            if (next > this.policy.maxTokenExposure) {
              approved = false;
              reasons.push("token exposure exceeded");
            }
          }
        }
      }
    }

    if (this.policy.maxSignalAgeSeconds !== undefined) {
      const eventSeconds = parseUnixSeconds(candidate.timestamp);
      if (eventSeconds === undefined) {
        approved = false;
        reasons.push("missing required data");
      } else {
        const now = context.nowSeconds ?? BigInt(Math.floor(Date.now() / 1000));
        const age = now > eventSeconds ? now - eventSeconds : 0n;
        if (age > BigInt(this.policy.maxSignalAgeSeconds)) {
          approved = false;
          reasons.push("stale signal");
        }
      }
    }

    if (reasons.length === 0) {
      reasons.push("no risk constraints");
    } else if (approved && !reasons.includes("exposure within limit")) {
      reasons.push("exposure within limit");
    }

    return { approved, reasons };
  }
}

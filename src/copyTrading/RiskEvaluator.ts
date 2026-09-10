import type { CopyTradePolicy, RiskContext, RiskDecision, TradeCandidate } from "./types.js";
import { tradeSize } from "./types.js";
import { parseActivityTimestamp } from "./timestamp.js";

export class RiskEvaluator {
  constructor(private readonly policy: CopyTradePolicy = {}) {}

  evaluate(candidate: TradeCandidate, context: RiskContext = {}): RiskDecision {
    const reasons: string[] = [];
    let approved = true;
    const size = tradeSize(candidate);
    const maxOpen = this.policy.maxConcurrentPositions ?? this.policy.maxOpenPositions;

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

    const needsState =
      this.policy.maxTokenExposure !== undefined ||
      this.policy.maxWalletExposure !== undefined ||
      maxOpen !== undefined;

    if (needsState) {
      const state = context.walletState;
      if (state === undefined) {
        approved = false;
        reasons.push("missing required data");
      } else {
        if (maxOpen !== undefined) {
          const open = state.positions.filter((position) => position.quantity > 0n).length;
          const nextOpen =
            candidate.side === "buy" &&
            !state.positions.some(
              (position) => position.token.toLowerCase() === candidate.token.toLowerCase(),
            )
              ? open + 1
              : open;
          if (nextOpen > maxOpen) {
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

        if (this.policy.maxWalletExposure !== undefined) {
          const current = state.positions.reduce((sum, position) => sum + position.quantity, 0n);
          const delta =
            candidate.side === "buy" && candidate.amountToken !== undefined
              ? candidate.amountToken
              : 0n;
          if (current + delta > this.policy.maxWalletExposure) {
            approved = false;
            reasons.push("wallet exposure exceeded");
          }
        }
      }
    }

    if (this.policy.maxSignalAgeSeconds !== undefined) {
      const eventSeconds = parseActivityTimestamp(candidate.timestamp);
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

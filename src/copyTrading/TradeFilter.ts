import { getAddress } from "viem";
import type { CopyTradeFilterConfig, LayerDecision, TradeCandidate } from "./types.js";
import { tradeSize } from "./types.js";

function addressSet(values: readonly string[] | undefined): Set<string> | undefined {
  if (values === undefined) {
    return undefined;
  }
  return new Set(values.map((value) => getAddress(value).toLowerCase()));
}

export class TradeFilter {
  constructor(private readonly config: CopyTradeFilterConfig = {}) {}

  evaluate(candidate: TradeCandidate): LayerDecision {
    const reasons: string[] = [];
    let approved = true;

    const wallet = candidate.wallet.toLowerCase();
    const token = candidate.token.toLowerCase();
    const allowedWallets = addressSet(this.config.allowedWallets);
    const excludedWallets = addressSet(this.config.excludedWallets);
    const allowedTokens = addressSet(this.config.allowedTokens);
    const excludedTokens = addressSet(this.config.excludedTokens);

    if (allowedWallets !== undefined) {
      if (allowedWallets.has(wallet)) {
        reasons.push("wallet allowed");
      } else {
        approved = false;
        reasons.push("wallet not allowlisted");
      }
    }

    if (excludedWallets?.has(wallet) === true) {
      approved = false;
      reasons.push("wallet excluded");
    }

    if (allowedTokens !== undefined) {
      if (allowedTokens.has(token)) {
        reasons.push("token allowed");
      } else {
        approved = false;
        reasons.push("token not allowlisted");
      }
    }

    if (excludedTokens?.has(token) === true) {
      approved = false;
      reasons.push("token excluded");
    }

    const size = tradeSize(candidate);
    if (this.config.minTradeSize !== undefined || this.config.maxTradeSize !== undefined) {
      if (size === undefined) {
        approved = false;
        reasons.push("missing trade size");
      } else {
        if (this.config.minTradeSize !== undefined && size < this.config.minTradeSize) {
          approved = false;
          reasons.push("trade below minimum");
        } else if (this.config.maxTradeSize !== undefined && size > this.config.maxTradeSize) {
          approved = false;
          reasons.push("trade above maximum");
        } else {
          reasons.push("trade size valid");
        }
      }
    }

    if (reasons.length === 0) {
      reasons.push("no filter constraints");
    }

    return { approved, reasons };
  }
}

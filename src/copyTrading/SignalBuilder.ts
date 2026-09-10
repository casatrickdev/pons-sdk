import type { LayerDecision, TradeCandidate, CopyTradeSignal } from "./types.js";
import { copyTradeSignalId } from "./types.js";

export class SignalBuilder {
  build(
    candidate: TradeCandidate,
    filter: LayerDecision,
    risk: LayerDecision,
    options: { detectionReasons?: string[]; createdAt?: string } = {},
  ): CopyTradeSignal {
    const approved = filter.approved && risk.approved;
    return {
      id: copyTradeSignalId(candidate.transactionHash, candidate.logIndex),
      sourceWallet: candidate.wallet,
      token: candidate.token,
      pool: candidate.pool,
      side: candidate.side,
      sourceTransaction: candidate.transactionHash,
      sourceLogIndex: candidate.logIndex,
      blockNumber: candidate.blockNumber,
      createdAt: options.createdAt ?? new Date().toISOString(),
      status: approved ? "approved" : "rejected",
      detectionReasons: options.detectionReasons ?? [
        `detected ${candidate.side} from wallet activity`,
      ],
      filterReasons: filter.reasons,
      riskReasons: risk.reasons,
    };
  }
}

import { PonsConfigError, errorMessage } from "../errors/PonsError.js";
import { normalizeWalletActivity } from "../wallets/WalletActivity.js";
import type { WalletActivityInput } from "../wallets/types.js";
import type { TradeCandidate, TradeDetection } from "./types.js";

export class TradeDetector {
  detect(activity: WalletActivityInput): TradeDetection {
    try {
      const normalized = normalizeWalletActivity(activity);
      const candidate: TradeCandidate = {
        wallet: normalized.wallet,
        token: normalized.token,
        pool: normalized.pool,
        side: normalized.side,
        amountToken: normalized.amountToken,
        amountQuote: normalized.amountQuote,
        blockNumber: normalized.blockNumber,
        transactionHash: normalized.transactionHash,
        logIndex: normalized.logIndex,
        timestamp: normalized.timestamp,
      };

      return {
        supported: true,
        reasons: [`detected ${candidate.side} from wallet activity`],
        candidate,
        activity: normalized,
      };
    } catch (error) {
      const reason =
        error instanceof PonsConfigError
          ? error.message
          : `unsupported activity: ${errorMessage(error)}`;
      return {
        supported: false,
        reasons: [reason],
      };
    }
  }
}

import { PonsError } from "../errors/PonsError.js";
import { type Address, type Hash, getAddress, isAddress, isHash } from "viem";
import type { WalletActivityInput, WalletState } from "../wallets/types.js";
import { TradeDetector } from "./TradeDetector.js";
import { TradeFilter } from "./TradeFilter.js";
import { RiskEvaluator } from "./RiskEvaluator.js";
import { SignalBuilder } from "./SignalBuilder.js";
import { formatCopyTradeExplanation } from "./explain.js";
import type { CopyTradeMode, CopyTradePolicy, CopyTradeSignal, RiskContext } from "./types.js";
import { copyTradeSignalId } from "./types.js";
import type { ExecutionAdapter } from "../execution/ExecutionAdapter.js";
import { NoopExecutionAdapter } from "../execution/NoopExecutionAdapter.js";
import type { ExecutionResult } from "../execution/types.js";

export const LIVE_EXECUTION_DISABLED = "Live execution is disabled";
const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000" as Hash;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

export interface CopyTradeEngineConfig {
  mode?: CopyTradeMode;
  policy?: CopyTradePolicy;
  walletState?: WalletState | ((wallet: string) => WalletState | undefined);
  now?: () => Date;
  executionAdapter?: ExecutionAdapter;
}

export class CopyTradeEngine {
  readonly mode: CopyTradeMode;
  private readonly detector = new TradeDetector();
  private readonly filter: TradeFilter;
  private readonly risk: RiskEvaluator;
  private readonly signals = new SignalBuilder();
  private readonly walletState: CopyTradeEngineConfig["walletState"];
  private readonly now: () => Date;
  private readonly executionAdapter: ExecutionAdapter;

  constructor(config: CopyTradeEngineConfig = {}) {
    const mode = config.mode ?? "research";
    if (mode !== "research") {
      throw new PonsError(LIVE_EXECUTION_DISABLED);
    }

    this.mode = mode;
    this.filter = new TradeFilter(config.policy ?? {});
    this.risk = new RiskEvaluator(config.policy ?? {});
    this.walletState = config.walletState;
    this.now = config.now ?? (() => new Date());
    this.executionAdapter = config.executionAdapter ?? new NoopExecutionAdapter();
  }

  process(activity: WalletActivityInput): CopyTradeSignal {
    const createdAt = this.now().toISOString();
    const detection = this.detector.detect(activity);

    if (!detection.supported || detection.candidate === undefined) {
      return {
        id: copyTradeSignalId(activity.transactionHash ?? ZERO_HASH, activity.logIndex ?? 0n),
        sourceWallet: isAddress(activity.wallet) ? getAddress(activity.wallet) : ZERO_ADDRESS,
        token: isAddress(activity.token) ? getAddress(activity.token) : ZERO_ADDRESS,
        side: activity.side === "sell" ? "sell" : "buy",
        sourceTransaction: isHash(activity.transactionHash) ? activity.transactionHash : ZERO_HASH,
        sourceLogIndex: activity.logIndex ?? 0n,
        createdAt,
        status: "rejected",
        detectionReasons: detection.reasons,
        filterReasons: ["detection failed"],
        riskReasons: ["detection failed"],
      };
    }

    const candidate = detection.candidate;
    const filterDecision = this.filter.evaluate(candidate);
    const riskDecision = this.risk.evaluate(candidate, this.riskContext(candidate.wallet));
    return this.signals.build(candidate, filterDecision, riskDecision, {
      detectionReasons: detection.reasons,
      createdAt,
    });
  }

  explain(signal: CopyTradeSignal): string {
    return formatCopyTradeExplanation(signal);
  }

  execute(_signal: CopyTradeSignal): Promise<ExecutionResult> {
    return Promise.reject(new PonsError(LIVE_EXECUTION_DISABLED));
  }

  previewExecution(signal: CopyTradeSignal): Promise<ExecutionResult> {
    return this.executionAdapter.execute(signal);
  }

  private riskContext(wallet: string): RiskContext {
    const nowSeconds = BigInt(Math.floor(this.now().getTime() / 1000));
    if (this.walletState === undefined) {
      return { nowSeconds };
    }
    const state =
      typeof this.walletState === "function" ? this.walletState(wallet) : this.walletState;
    return { walletState: state, nowSeconds };
  }
}

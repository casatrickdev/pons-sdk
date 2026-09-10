import type { CopyTradeSignal } from "../copyTrading/types.js";
import type { ExecutionAdapter } from "./ExecutionAdapter.js";
import type { ExecutionResult } from "./types.js";

export const RESEARCH_EXECUTION_DISABLED = "Live execution disabled in research mode";

export class NoopExecutionAdapter implements ExecutionAdapter {
  execute(_signal: CopyTradeSignal): Promise<ExecutionResult> {
    return Promise.resolve({
      status: "not_executed",
      reason: RESEARCH_EXECUTION_DISABLED,
    });
  }
}

import type { ExecutionResult } from "./types.js";
import type { CopyTradeSignal } from "../copyTrading/types.js";

export interface ExecutionAdapter {
  execute(signal: CopyTradeSignal): Promise<ExecutionResult>;
}

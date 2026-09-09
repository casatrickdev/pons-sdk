export interface ExecutionResult {
  status: "not_executed" | "submitted" | "failed";
  reason: string;
}

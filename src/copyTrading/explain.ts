import type { CopyTradeSignal } from "./types.js";

function formatReasons(title: string, reasons: readonly string[]): string {
  const lines = reasons.map((reason) => {
    const failed =
      reason.includes("not ") ||
      reason.includes("excluded") ||
      reason.includes("below") ||
      reason.includes("above") ||
      reason.includes("exceed") ||
      reason.includes("stale") ||
      reason.includes("missing") ||
      reason.includes("unsupported") ||
      reason.includes("disabled") ||
      reason.includes("failed") ||
      reason.includes("limit exceeded");
    return `${failed ? "✗" : "✓"} ${reason}`;
  });
  return `${title}:\n${lines.join("\n")}`;
}

export function formatCopyTradeExplanation(signal: CopyTradeSignal): string {
  return [
    `Wallet: ${signal.sourceWallet}`,
    `Token: ${signal.token}`,
    `Side: ${signal.side.toUpperCase()}`,
    "",
    formatReasons("Detection", signal.detectionReasons),
    "",
    formatReasons("Filter", signal.filterReasons),
    "",
    formatReasons("Risk", signal.riskReasons),
    "",
    `Signal:\n${signal.status.toUpperCase()}`,
    "",
    "Execution:\nDISABLED",
  ].join("\n");
}

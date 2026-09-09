import type { CopyTradeSignal } from "./types.js";

function formatReasons(title: string, reasons: readonly string[], approved: boolean): string {
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
      reason.includes("limit exceeded");
    const mark = approved || !failed ? "✓" : "✗";
    return `${mark} ${reason}`;
  });
  return `${title}:\n${lines.join("\n")}`;
}

export function formatCopyTradeExplanation(signal: CopyTradeSignal): string {
  const filterApproved = signal.filterReasons.every(
    (reason) =>
      !reason.includes("not ") &&
      !reason.includes("excluded") &&
      !reason.includes("below") &&
      !reason.includes("above") &&
      !reason.includes("missing"),
  );
  const riskApproved = !signal.riskReasons.some(
    (reason) =>
      reason.includes("exceed") ||
      reason.includes("stale") ||
      reason.includes("missing") ||
      reason.includes("limit exceeded"),
  );

  return [
    `Wallet: ${signal.sourceWallet}`,
    `Trade: ${signal.side.toUpperCase()}`,
    `Token: ${signal.token}`,
    `Detection: ${signal.detectionReasons.join("; ")}`,
    "",
    formatReasons("Filter", signal.filterReasons, filterApproved),
    "",
    formatReasons("Risk", signal.riskReasons, riskApproved),
    "",
    `Result:\n${signal.status.toUpperCase()}`,
  ].join("\n");
}

import type { PonsDebugFn } from "./types/config.js";

export function createDebugLogger(debug?: boolean | PonsDebugFn): PonsDebugFn {
  if (!debug) {
    return () => undefined;
  }

  if (typeof debug === "function") {
    return debug;
  }

  return (message, context) => {
    if (context === undefined) {
      console.debug(`[pons-sdk] ${message}`);
      return;
    }
    console.debug(`[pons-sdk] ${message}`, context);
  };
}

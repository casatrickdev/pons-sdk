import type { Transport } from "viem";

export type PonsDebugFn = (message: string, context?: Record<string, unknown>) => void;

export interface PonsClientConfig {
  rpcUrl?: string;
  /**
   * Optional viem transport. When provided, it replaces the default HTTP
   * transport built from `rpcUrl`. Intended for tests and custom transports.
   */
  transport?: Transport;
  defaultChunkSize?: bigint;
  debug?: boolean | PonsDebugFn;
}

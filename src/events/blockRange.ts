import { PonsConfigError } from "../errors/PonsError.js";

export const DEFAULT_LOG_CHUNK_SIZE = 2_000n;

export interface BlockRange {
  fromBlock: bigint;
  toBlock: bigint;
}

export function resolveToBlock(
  toBlock: bigint | "latest" | undefined,
  latestBlock: bigint,
): bigint {
  if (toBlock === undefined || toBlock === "latest") {
    return latestBlock;
  }

  return toBlock;
}

export function splitBlockRange(
  fromBlock: bigint,
  toBlock: bigint,
  chunkSize: bigint = DEFAULT_LOG_CHUNK_SIZE,
): BlockRange[] {
  if (chunkSize <= 0n) {
    throw new PonsConfigError("chunkSize must be greater than 0", { field: "chunkSize" });
  }

  if (fromBlock < 0n) {
    throw new PonsConfigError("fromBlock must be greater than or equal to 0", {
      field: "fromBlock",
    });
  }

  if (fromBlock > toBlock) {
    throw new PonsConfigError("fromBlock must be less than or equal to toBlock", {
      field: "fromBlock",
    });
  }

  const chunks: BlockRange[] = [];
  let start = fromBlock;

  while (start <= toBlock) {
    const end = start + chunkSize - 1n;
    chunks.push({
      fromBlock: start,
      toBlock: end > toBlock ? toBlock : end,
    });
    start = end + 1n;
  }

  return chunks;
}

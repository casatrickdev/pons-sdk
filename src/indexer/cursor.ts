import type { PonsDatabase } from "../storage/Database.js";
import { PONS_TOKEN_LAUNCHED_STATE_NAME } from "./types.js";

export function readIndexerCursor(
  database: PonsDatabase,
  name: string = PONS_TOKEN_LAUNCHED_STATE_NAME,
): bigint | undefined {
  const row = database.sqlite
    .prepare("SELECT last_processed_block FROM indexer_state WHERE name = ?")
    .get(name) as { last_processed_block: string } | undefined;

  if (row === undefined) {
    return undefined;
  }

  return BigInt(row.last_processed_block);
}

export function writeIndexerCursor(
  database: PonsDatabase,
  block: bigint,
  name: string = PONS_TOKEN_LAUNCHED_STATE_NAME,
): void {
  const current = readIndexerCursor(database, name);
  if (current !== undefined && current >= block) {
    return;
  }

  database.sqlite
    .prepare(
      `
      INSERT INTO indexer_state (name, last_processed_block)
      VALUES (@name, @last_processed_block)
      ON CONFLICT(name) DO UPDATE SET last_processed_block = excluded.last_processed_block
      WHERE CAST(excluded.last_processed_block AS INTEGER) > CAST(indexer_state.last_processed_block AS INTEGER)
      `,
    )
    .run({
      name,
      last_processed_block: block.toString(),
    });
}

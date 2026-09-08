export const PONS_INDEXER_SCHEMA = `
CREATE TABLE IF NOT EXISTS launches (
  id INTEGER PRIMARY KEY,
  version TEXT NOT NULL CHECK (version IN ('v1', 'v2')),
  token_address TEXT NOT NULL,
  deployer TEXT NOT NULL,
  factory TEXT NOT NULL,
  dex_factory TEXT,
  pair_token TEXT,
  pool_address TEXT,
  curve TEXT,
  dex_id TEXT,
  launch_config_id TEXT,
  position_id TEXT,
  restrictions_end_block TEXT,
  initial_buy_amount TEXT,
  graduation_threshold TEXT,
  block_number TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  transaction_index TEXT,
  log_index TEXT NOT NULL,
  timestamp TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (transaction_hash, log_index)
);

CREATE INDEX IF NOT EXISTS launches_block_order
  ON launches (block_number, transaction_index, log_index);
CREATE INDEX IF NOT EXISTS launches_token ON launches (token_address);
CREATE INDEX IF NOT EXISTS launches_deployer ON launches (deployer);
CREATE INDEX IF NOT EXISTS launches_pool ON launches (pool_address);
CREATE INDEX IF NOT EXISTS launches_version ON launches (version);

CREATE TABLE IF NOT EXISTS indexer_state (
  name TEXT PRIMARY KEY,
  last_processed_block TEXT NOT NULL
);
`;

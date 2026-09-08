import { PonsClient, PonsDatabase, PonsIndexer } from "../src/index.js";

const database = new PonsDatabase("pons-indexer.sqlite");
const indexer = new PonsIndexer({
  client: new PonsClient(),
  database,
  resolveTimestamps: false,
});

const status = indexer.getSyncStatus();
const launches = indexer.getLatestLaunches(20);

console.log(
  `Cursor ${status.lastProcessedBlock?.toString() ?? "(none)"} · ${String(status.launchCount)} launches`,
);

for (const launch of launches) {
  console.log(
    `${launch.blockNumber} ${launch.version} ${launch.token} ${launch.transactionHash}:${launch.logIndex}`,
  );
}

database.close();

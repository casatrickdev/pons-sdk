import { PonsClient, PonsDatabase, PonsIndexer } from "../src/index.js";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

const from = readArg("--from");
const to = readArg("--to");

if (from === undefined || to === undefined) {
  console.error("Usage: pnpm indexer:sync --from <block> --to <block>");
  process.exit(1);
}

const database = new PonsDatabase("pons-indexer.sqlite");
const indexer = new PonsIndexer({
  client: new PonsClient(),
  database,
  onProgress: (event) => {
    console.log(`Syncing blocks ${event.fromBlock.toString()} → ${event.toBlock.toString()}`);
    console.log(`Found ${String(event.found)} launches`);
    console.log(`Inserted ${String(event.inserted)} launches`);
    console.log(`Cursor: ${event.cursor.toString()}`);
  },
});

const result = await indexer.sync({
  fromBlock: BigInt(from),
  toBlock: BigInt(to),
});

console.log(
  `Done. found=${String(result.found)} inserted=${String(result.inserted)} cursor=${result.lastProcessedBlock?.toString() ?? "none"}`,
);

database.close();

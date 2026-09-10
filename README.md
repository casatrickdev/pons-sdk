# Pons SDK

Robinhood Chain trading tools for Pons. TypeScript SDK for token launches, a historical indexer, and research for a Robinhood copy trading bot. A Robinhood sniper bot and Robinhood bundler are on the roadmap and are not live.

Typed access to Pons factory contracts, token launches, and `TokenLaunched` events with [viem](https://viem.sh) queries.

Site: [casatrickdev.github.io/pons-sdk](https://casatrickdev.github.io/pons-sdk/)

Write-up: [Pons SDK on Robinhood Chain](https://casatrick.substack.com/p/pons-sdk-robinhood-chain)

This package is read-only. It does not sign transactions, hold keys, or execute trades.

This is a client for Pons on Robinhood Chain. It is not [Pons Network](https://pons.sh/) (`@pons-network/pons.js`) or the [Pons microkernel SDK](https://jsr.io/@pons/sdk).

## Features

- Robinhood Chain support
- Pons contract interaction
- Launch discovery
- `TokenLaunched` event decoding
- typed blockchain data
- safe block-range querying
- read-only integration
- historical launch indexer
- Robinhood copy trading bot research (no execution)

## Installation

```bash
pnpm add pons-sdk
```

Peer runtime: Node.js 20+ and [viem](https://viem.sh).

## Quickstart

```ts
import { PonsClient } from "pons-sdk";

const pons = new PonsClient();

const launches = await pons.getLaunches({
  fromBlock: 8_991_118n,
  toBlock: "latest",
});

for (const launch of launches.slice(0, 10)) {
  console.log(launch);
}
```

The public Robinhood Chain RPC times out on wide `eth_getLogs` ranges. The SDK splits requests into bounded chunks (2,000 blocks by default). A full backfill from the V1 start block still takes time against the public endpoint; prefer a tighter `toBlock` while developing.

Override the RPC when you have a dedicated provider:

```ts
const pons = new PonsClient({
  rpcUrl: "https://your-robinhood-rpc.example",
});
```

## Reading a launch

```ts
import { PONS_REFERENCE, PonsClient } from "pons-sdk";

const pons = new PonsClient();

const launch = await pons.getLaunch(PONS_REFERENCE.token, {
  version: "v1",
  includeLegacy: true,
});

const graduation = await pons.getGraduationStatus(PONS_REFERENCE.token, {
  includeLegacy: true,
});
```

V1 and V2 factories have different `TokenLaunched` ABIs and different `getLaunchedToken` records. The SDK models them as separate types instead of collapsing incompatible fields.

```ts
const v2Launches = await pons.getLaunches({
  fromBlock: 55_400_000n,
  toBlock: "latest",
  version: "v2",
});

const canLaunch = await pons.canLaunch("0x...");
```

## Event filtering

`token` and `deployer` are indexed on both factory generations and can be passed through to `eth_getLogs`:

```ts
const launches = await pons.getLaunches({
  fromBlock: 8_991_118n,
  toBlock: 8_993_118n,
  token: "0x39dBED3a2bd333467115dE45665cC57F813C4571",
});
```

`pool` is not an indexed `TokenLaunched` argument on V1, and V2 has no pool field on that event. The SDK does not pretend those filters exist at the RPC layer.

## Architecture

```text
Robinhood Chain
      ↓
Pons Contracts
      ↓
Events
      ↓
Pons SDK
      ↓
Historical Indexer / SQLite
      ↓
Future Analytics / Scanner
```

| Layer        | Responsibility                                          |
| ------------ | ------------------------------------------------------- |
| `chain/`     | Robinhood Chain definition and default public RPC       |
| `contracts/` | Official factory addresses and verified ABI fragments   |
| `events/`    | Block-range chunking, log fetch, `TokenLaunched` decode |
| `launches/`  | Normalized launch objects and verified contract reads   |
| `client/`    | Developer-facing `PonsClient`                           |
| `indexer/`   | Historical `TokenLaunched` sync, cursor, and queries    |
| `storage/`   | SQLite schema and launch persistence                    |

Contract addresses and event signatures come from the official Pons documentation and the [ponsdotdev/ponsfamily](https://github.com/ponsdotdev/ponsfamily) repository. They are not invented and are not taken from a third-party SDK.

## Contracts

| Generation | Role           | Address                                      | Start block |
| ---------- | -------------- | -------------------------------------------- | ----------- |
| V1         | Active factory | `0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB` | 8,991,118   |
| V1         | Legacy factory | `0x0c37a24F5D23A486FA692d1500881d698B1F77a4` | 8,600,612   |
| V2         | Factory        | `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e` | —           |

The official PONS reference token (`0x39dBED3a2bd333467115dE45665cC57F813C4571`) was launched through the V1 legacy factory. Use `includeLegacy: true` when you need that history.

## Milestone 1

Milestone 1 is the read-only data layer: connect to Robinhood Chain, talk to the official Pons V1 and V2 factories, and turn real `TokenLaunched` logs into typed objects.

```text
Robinhood Chain
      ↓
Pons Contracts
      ↓
Onchain Events
      ↓
Typed SDK
```

Shipped in this milestone:

- Robinhood Chain client and public RPC
- Pons V1 / V2 factory addresses and ABI fragments
- Live contract reads (`getLaunchedToken`, `canLaunch`, graduation status)
- `TokenLaunched` decoding against real onchain logs
- Chunked `getLogs` with merge, dedupe, and sort
- Launch queries (`getLaunches`, `getLaunch`)
- 30 unit tests and 3 live RPC integration tests

The next milestone after this read layer is persistent historical state. Milestone 2 (the SQLite indexer) is included in this package.

Full write-up: [Building a Pons SDK on Robinhood Chain](https://casatrick.substack.com/p/pons-sdk-robinhood-chain).

## Historical Indexer

Milestone 2 turns decoded `TokenLaunched` events into local, queryable history.

```text
Pons contracts
      ↓
TokenLaunched events
      ↓
Pons SDK
      ↓
Historical indexer
      ↓
SQLite
      ↓
Queryable launches
```

The indexer uses the SDK's `getLaunches()` and `splitBlockRange()` helpers. It does not send transactions. Blockchain integers are stored as decimal strings.

Re-processing the same block range does not create duplicate events. Identity is `transactionHash + logIndex`, enforced by a SQLite unique constraint. The indexer can safely replay a range. It does not unwind chain reorganizations.

```ts
import { PonsClient, PonsDatabase, PonsIndexer } from "pons-sdk";

const indexer = new PonsIndexer({
  client: new PonsClient(),
  database: new PonsDatabase("pons-indexer.sqlite"),
});

await indexer.sync({
  fromBlock: 8_963_000n,
  toBlock: 8_965_000n,
});

const launches = indexer.getLatestLaunches(20);
```

Resume after a stop by omitting `fromBlock`. The cursor only advances after the chunk is committed.

```bash
pnpm indexer:sync --from 8963000 --to 8965000
pnpm indexer:latest
```

## Copy-Trading Research

This module detects and evaluates wallet activity but does not execute trades.

Copy-trade domain logic is tested against **normalized synthetic domain fixtures**. Real Pons wallet/swap ingestion will be connected when the indexer supports those events. Token addresses used in tests can still come from live Robinhood Chain reads.

```text
Pons Events
     ↓
Indexer
     ↓
Wallet Activity
     ↓
Trade Detection
     ↓
Filtering
     ↓
Risk
     ↓
Copy-Trade Signal
     ↓
Execution Adapter
        X
   Disabled
```

Research-only: `mode` is `research`. Constructing `live` throws. Signals use a deterministic id (`transactionHash + logIndex`). Filtering and risk are separate deterministic layers. No private keys. No live execution. `engine.execute()` throws `Live execution is disabled in research mode`. `NoopExecutionAdapter` returns `not_executed`.

```ts
import { CopyTradeEngine } from "pons-sdk";

const engine = new CopyTradeEngine({
  mode: "research",
  policy: {
    allowedWallets: ["0x..."],
    minTradeSize: 1n,
  },
});

const signal = engine.process(activity);
console.log(engine.explain(signal));
```

## Robinhood copy trading bot, sniper bot, and bundler

This repo is the open-source foundation for Robinhood Chain trading tools:

| Tool                          | Status                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------- |
| Robinhood copy trading bot    | Research pipeline only. Detects and scores wallet activity. Does not copy trades. |
| Robinhood sniper bot          | Not implemented. Planned after swap indexing and a real-time event stream.        |
| Robinhood bundler             | Not implemented. Planned after paper execution.                                   |
| Other Robinhood trading tools | Launch indexer and read-only SDK are available now.                               |

Live copy-trading, sniping, bundling, and fund execution are disabled. There is no environment flag that turns them on.

Real trading is not implemented. If it is added later, do not use the public Robinhood Chain RPC (`https://rpc.mainnet.chain.robinhood.com`). Live reads and execution need a dedicated paid RPC such as [Alchemy](https://www.alchemy.com/) or [QuickNode](https://www.quicknode.com/), passed as `rpcUrl` on `PonsClient`.

## Roadmap

```text
[x] Robinhood Chain client
[x] Pons V1/V2 contracts
[x] Contract reads
[x] TokenLaunched decoding
[x] Launch queries
[x] SDK tests
[x] Live RPC tests

[x] Historical indexer
[x] Persistent indexed state
[x] Copy-trading research architecture
[x] Read-only signal pipeline

[ ] Real-time event stream
[ ] Wallet activity indexing
[ ] Wallet intelligence
[ ] Copy-trading backtesting
[ ] Paper execution
[ ] Live execution
[ ] Scanner
[ ] Bundler
[ ] Sniper
[ ] Additional Robinhood Chain launchpads
[ ] Swap indexing
```

## Development

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Read-only integration tests hit the public Robinhood Chain RPC and never require a wallet:

```bash
pnpm test:integration
```

Run the example:

```bash
pnpm example:launches
pnpm indexer:sync --from 8963000 --to 8965000
pnpm indexer:latest
```

## Safety

This package is data infrastructure and copy-trading research only.

- No private-key handling
- No transaction signing
- No live copy-trading, sniping, or execution
- No wallet custody
- The execution adapter is a no-op and cannot be armed with an environment flag
- Real trading, if ever enabled, requires a paid RPC (Alchemy or QuickNode), not the public endpoint

On-chain values stay as `bigint` / addresses. The SDK does not convert token amounts to floating-point numbers.

## License

[MIT](./LICENSE)

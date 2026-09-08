# Pons SDK

TypeScript SDK for Pons on Robinhood Chain. Read token launches, factory contracts, and `TokenLaunched` events with typed [viem](https://viem.sh) queries.

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

## Roadmap

```text
[x] Robinhood Chain client
[x] Pons V1/V2 contracts
[x] Contract reads
[x] TokenLaunched decoding
[x] Chunked event queries
[x] Launch queries
[x] Unit tests
[x] Live integration tests

[x] Historical TokenLaunched indexer
[x] Persistent launch state
[ ] Real-time event stream
[ ] Swap indexing
[ ] Token state
[ ] Market analytics
[ ] Scanner
[ ] Strategy research
[ ] Trading integration
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

This package is data infrastructure only.

- No private-key handling
- No transaction signing
- No trading, sniping, or copy-trading
- No wallet custody

On-chain values stay as `bigint` / addresses. The SDK does not convert token amounts to floating-point numbers.

## License

[MIT](./LICENSE)

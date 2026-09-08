import { launchIdentity } from "../events/decodeTokenLaunched.js";
import type { PonsLaunch } from "../types/launch.js";

export function launchEventIdentity(transactionHash: string, logIndex: bigint | string): string {
  return `${transactionHash.toLowerCase()}:${BigInt(logIndex).toString()}`;
}

export function uniqueLaunches(launches: readonly PonsLaunch[]): PonsLaunch[] {
  const seen = new Set<string>();
  const unique: PonsLaunch[] = [];

  for (const launch of launches) {
    const id = launchIdentity(launch);
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    unique.push(launch);
  }

  return unique;
}

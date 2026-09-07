import type { GetLaunchesParams, PonsLaunch } from "../types/launch.js";
import { decodeTokenLaunched, dedupeAndSortLaunches } from "../events/decodeTokenLaunched.js";
import {
  queryTokenLaunchedLogs,
  type QueryTokenLaunchedLogsContext,
} from "../events/getTokenLaunchedLogs.js";

export async function queryLaunches(
  params: GetLaunchesParams,
  context: QueryTokenLaunchedLogsContext,
): Promise<PonsLaunch[]> {
  const logs = await queryTokenLaunchedLogs(params, context);
  const launches = logs.map((log) => decodeTokenLaunched(log));
  return dedupeAndSortLaunches(launches);
}

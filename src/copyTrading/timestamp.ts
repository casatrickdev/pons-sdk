export function parseActivityTimestamp(timestamp: string | undefined): bigint | undefined {
  if (timestamp === undefined || timestamp.length === 0) {
    return undefined;
  }

  if (/^\d+$/.test(timestamp)) {
    return BigInt(timestamp);
  }

  const millis = Date.parse(timestamp);
  if (Number.isNaN(millis)) {
    return undefined;
  }
  return BigInt(Math.floor(millis / 1000));
}

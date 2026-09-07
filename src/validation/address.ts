import { type Address, getAddress, isAddress } from "viem";
import { PonsConfigError } from "../errors/PonsError.js";

export function requireAddress(value: string, field: string): Address {
  if (!isAddress(value, { strict: false })) {
    throw new PonsConfigError(`Invalid address for ${field}: ${value}`, { field });
  }

  return getAddress(value);
}

export function optionalAddress(value: string | undefined, field: string): Address | undefined {
  if (value === undefined) {
    return undefined;
  }

  return requireAddress(value, field);
}

import type { Address, PublicClient } from "viem";
import { ROBINHOOD_CHAIN_ID } from "../chain/robinhoodChain.js";
import type { PonsVersion } from "../contracts/addresses.js";
import { PonsContractError, PonsRpcError, errorMessage } from "../errors/PonsError.js";
import type { PonsDebugFn } from "../types/config.js";

export type PonsPublicClient = Pick<PublicClient, "getBlockNumber" | "getLogs" | "readContract">;

export async function readChainBlockNumber(
  client: Pick<PonsPublicClient, "getBlockNumber">,
  operation: string,
): Promise<bigint> {
  try {
    return await client.getBlockNumber();
  } catch (error) {
    throw new PonsRpcError(`RPC call failed during ${operation}: ${errorMessage(error)}`, {
      operation,
      chainId: ROBINHOOD_CHAIN_ID,
      cause: error,
    });
  }
}

export async function readPonsContract<T>(
  operation: string,
  version: PonsVersion,
  address: Address,
  debug: PonsDebugFn,
  reader: () => Promise<T>,
): Promise<T> {
  debug(operation, { version, address });

  try {
    return await reader();
  } catch (error) {
    if (error instanceof PonsContractError || error instanceof PonsRpcError) {
      throw error;
    }

    throw new PonsContractError(`${operation} failed: ${errorMessage(error)}`, {
      operation,
      address,
      version,
      cause: error,
    });
  }
}

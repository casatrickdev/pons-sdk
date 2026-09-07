import type { Address } from "viem";

export interface PonsErrorOptions {
  cause?: unknown;
}

export class PonsError extends Error {
  readonly cause?: unknown;

  constructor(message: string, options: PonsErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "PonsError";
    this.cause = options.cause;
  }
}

export interface PonsConfigErrorOptions extends PonsErrorOptions {
  field?: string;
}

export class PonsConfigError extends PonsError {
  readonly field?: string;

  constructor(message: string, options: PonsConfigErrorOptions = {}) {
    super(message, options);
    this.name = "PonsConfigError";
    this.field = options.field;
  }
}

export interface PonsRpcErrorOptions extends PonsErrorOptions {
  operation: string;
  chainId: number;
  fromBlock?: bigint;
  toBlock?: bigint | string;
}

export class PonsRpcError extends PonsError {
  readonly operation: string;
  readonly chainId: number;
  readonly fromBlock?: bigint;
  readonly toBlock?: bigint | string;

  constructor(message: string, options: PonsRpcErrorOptions) {
    super(message, options);
    this.name = "PonsRpcError";
    this.operation = options.operation;
    this.chainId = options.chainId;
    this.fromBlock = options.fromBlock;
    this.toBlock = options.toBlock;
  }
}

export interface PonsContractErrorOptions extends PonsErrorOptions {
  operation: string;
  address?: Address;
  version?: string;
}

export class PonsContractError extends PonsError {
  readonly operation: string;
  readonly address?: Address;
  readonly version?: string;

  constructor(message: string, options: PonsContractErrorOptions) {
    super(message, options);
    this.name = "PonsContractError";
    this.operation = options.operation;
    this.address = options.address;
    this.version = options.version;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return String(error);
}

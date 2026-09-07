import { defineChain } from "viem";

export const ROBINHOOD_CHAIN_ID = 4663;

export const ROBINHOOD_CHAIN_RPC_URL = "https://rpc.mainnet.chain.robinhood.com";

export const robinhoodChain = defineChain({
  id: ROBINHOOD_CHAIN_ID,
  name: "Robinhood Chain",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [ROBINHOOD_CHAIN_RPC_URL],
    },
  },
});

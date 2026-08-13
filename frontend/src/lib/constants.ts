export const CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONTRACT_ID ?? "CC7AAAAKAAAAA7JAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org:443";

export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";

export const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export const MAX_U64 = BigInt("0xFFFFFFFFFFFFFFFF");

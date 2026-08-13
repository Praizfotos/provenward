#!/usr/bin/env node

// Deploys the Provenward contract to a Stellar network (testnet by default)
// and initializes it with an admin. Build the wasm first:
//
//   cargo build --release --target wasm32v1-none  (in contract/)
//
// Usage:
//   node deploy-testnet.mjs \
//     --secret S... \
//     [--wasm path/to/provenward.wasm] \
//     [--admin G...] \
//     [--rpc-url https://soroban-testnet.stellar.org:443] \
//     [--network-passphrase "Test SDF Network ; September 2015"]
//
// Environment variables with the same semantics may be used instead:
//   DEPLOY_SECRET, CONTRACT_WASM, ADMIN_ADDRESS, SOROBAN_RPC_URL,
//   STELLAR_NETWORK_PASSPHRASE

import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  Operation,
  TransactionBuilder,
  rpc,
} from "@stellar/stellar-sdk";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function arg(name, envName, defaultValue) {
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  if (process.env[envName]) {
    return process.env[envName];
  }
  return defaultValue;
}

const SECRET = arg("secret", "DEPLOY_SECRET", "");
const ADMIN = arg("admin", "ADMIN_ADDRESS", "");
const WASM_PATH =
  arg("wasm", "CONTRACT_WASM", resolve(ROOT, "contract/target/wasm32v1-none/release/provenward.wasm"));
const RPC_URL =
  arg("rpc-url", "SOROBAN_RPC_URL", "https://soroban-testnet.stellar.org:443");
const NETWORK_PASSPHRASE =
  arg(
    "network-passphrase",
    "STELLAR_NETWORK_PASSPHRASE",
    "Test SDF Network ; September 2015",
  );

if (!SECRET) {
  console.error("Usage: deploy-testnet.mjs --secret S... (see the header of this file)");
  process.exit(1);
}

const keypair = Keypair.fromSecret(SECRET);
const admin = ADMIN || keypair.publicKey();
const server = new rpc.Server(RPC_URL);

function log(message) {
  // eslint-disable-next-line no-console
  console.log(`[deploy] ${message}`);
}

async function getAccount() {
  try {
    return await server.getAccount(keypair.publicKey());
  } catch (error) {
    throw new Error(
      `Account ${keypair.publicKey()} is not funded on this network (${RPC_URL}). ` +
        "Fund it with friendbot or a faucet first. " +
        `(${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function submitAndWait(tx, label) {
  log(`${label}: submitting…`);
  const result = await server.sendTransaction(tx);
  if (result.status === "ERROR") {
    throw new Error(`${label} submission failed: ${result.errorResult?.error() ?? "unknown error"}`);
  }
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const status = await server.getTransaction(result.hash);
    if (status.status === "SUCCESS") {
      log(`${label}: confirmed (hash ${result.hash})`);
      return status;
    }
    if (status.status === "FAILED") {
      throw new Error(`${label} failed on chain`);
    }
    await sleep(1_000);
  }
  throw new Error(`${label} timed out waiting for confirmation`);
}

async function prepareAndSubmit(tx, label) {
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(keypair);
  return submitAndWait(prepared, label);
}

async function main() {
  const wasm = readFileSync(WASM_PATH);
  const wasmHash = createHash("sha256").update(wasm).digest();
  if (wasm.length === 0) {
    throw new Error(`wasm file is empty: ${WASM_PATH}`);
  }
  log(`wasm: ${WASM_PATH} (${wasm.length} bytes, sha256=${wasmHash.toString("hex")})`);
  log(`deployer: ${keypair.publicKey()}`);
  log(`admin: ${admin}`);
  log(`rpc: ${RPC_URL}`);

  const source = await getAccount();
  const baseOptions = {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  };

  // 1. Upload the wasm blob.
  const uploadTx = new TransactionBuilder(source, baseOptions)
    .addOperation(Operation.uploadContractWasm({ wasm }))
    .setTimeout(60)
    .build();
  await prepareAndSubmit(uploadTx, "contract wasm upload");
  log(`wasm hash: ${wasmHash.toString("hex")}`);

  // 2. Create the contract instance with a random salt.
  const salt = randomBytes(32);
  const createTx = new TransactionBuilder(await getAccount(), baseOptions)
    .addOperation(
      Operation.createCustomContract({
        address: new Address(keypair.publicKey()),
        wasmHash,
        salt,
        constructorArgs: [],
      }),
    )
    .setTimeout(60)
    .build();

  const simulated = await server.simulateTransaction(createTx);
  if (rpc.Api.isSimulationError(simulated)) {
    throw new Error(`create-contract simulation failed: ${simulated.error}`);
  }
  if (!simulated.result) {
    throw new Error("create-contract simulation returned no result");
  }
  const contractId = Address.fromScVal(simulated.result.retval).toString();
  log(`contract id will be: ${contractId}`);

  await prepareAndSubmit(createTx, "contract creation");
  log("contract created");

  // 3. Initialize the contract with the admin.
  const contract = new Contract(contractId);
  const initTx = new TransactionBuilder(await getAccount(), baseOptions)
    .addOperation(
      contract.call("initialize", new Address(admin).toScVal()),
    )
    .setTimeout(60)
    .build();

  const initialized = await prepareAndSubmit(initTx, "initialize(admin)");

  const deployment = {
    network: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    contractId,
    admin,
    deployer: keypair.publicKey(),
    wasmHash: wasmHash.toString("hex"),
    deployedAt: new Date().toISOString(),
  };
  const outDir = resolve(ROOT, "deployments");
  mkdirSync(outDir, { recursive: true });
  const outFile = resolve(outDir, "testnet.json");
  writeFileSync(outFile, `${JSON.stringify(deployment, null, 2)}\n`);
  log(`wrote ${outFile}`);

  log("deployment complete");
  log("--- SAVE THESE IN .env / .env.local -------------------------------");
  log(`CONTRACT_ID=${contractId}`);
  log(`MIGRATION_LEDGER=${initialized.fullLedgerSequence?.toString() ?? "see tx meta"}`);
  log("-------------------------------------------------------------------");
}

main().catch((error) => {
  console.error("[deploy] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
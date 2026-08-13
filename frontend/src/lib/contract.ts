import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  SorobanDataBuilder,
  TransactionBuilder,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";

import { CONTRACT_ID, NETWORK_PASSPHRASE, SOROBAN_RPC_URL } from "./constants";

export type Severity = "Info" | "Warning" | "Critical";

export interface RegisterBatchInput {
  batchIdHex: string;
  productName: string;
  serialRangeStart: bigint;
  serialRangeEnd: bigint;
  manufacturedDate: bigint;
}

export interface IssueRecallInput {
  batchIdHex: string;
  severity: Severity;
  messageHashHex: string;
  affectedSerialStart: bigint;
  affectedSerialEnd: bigint;
}

export class TransactionSubmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransactionSubmissionError";
  }
}

function scvU64(value: bigint): xdr.ScVal {
  return xdr.ScVal.scvU64(xdr.Uint64.fromString(value.toString()));
}

function scvBytes(hex: string): xdr.ScVal {
  return xdr.ScVal.scvBytes(Buffer.from(hex.replace(/^0x/, ""), "hex"));
}

function scvString(value: string): xdr.ScVal {
  return xdr.ScVal.scvString(value);
}

function scvSeverity(severity: Severity): xdr.ScVal {
  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(severity)]);
}

async function waitForTransaction(
  server: rpc.Server,
  hash: string,
  timeoutMs = 90_000,
): Promise<rpc.Api.GetSuccessfulTransactionResponse> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await server.getTransaction(hash);
    if (response.status === "NOT_FOUND") {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      continue;
    }
    if (response.status === "SUCCESS") {
      return response as rpc.Api.GetSuccessfulTransactionResponse;
    }
    if (response.status === "FAILED") {
      throw new TransactionSubmissionError(
        "Transaction failed on the network. Check your inputs and try again.",
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new TransactionSubmissionError("Timed out waiting for transaction confirmation");
}

/**
 * Builds, simulates, signs, and submits a Soroban invoke against the
 * Provenward contract. The wallet must hold the private key for `publicKey`
 * and the account must exist (be funded) on the configured network.
 */
async function invoke(
  publicKey: string,
  method: string,
  args: xdr.ScVal[],
): Promise<{ hash: string; status: string }> {
  const server = new rpc.Server(SOROBAN_RPC_URL);
  const account = await server.getAccount(publicKey);
  const contract = new Contract(CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  const prepared = await server.prepareTransaction(tx);
  const signed = await signTransaction(prepared.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  if (signed.error) {
    throw new TransactionSubmissionError(
      signed.error.message ?? "User rejected the transaction",
    );
  }

  const submitted = await server.sendTransaction(
    TransactionBuilder.fromXDR(signed.signedTxXdr, NETWORK_PASSPHRASE),
  );
  if (submitted.status === "ERROR") {
    const detail = submitted.errorResult
      ? ` (${submitted.errorResult.result().switch().name})`
      : "";
    throw new TransactionSubmissionError(`Transaction submission failed${detail}`);
  }

  const confirmed = await waitForTransaction(server, submitted.hash);
  return { hash: submitted.hash, status: confirmed.status };
}

export async function registerOwnershipReceipt(
  publicKey: string,
  batchIdHex: string,
  serialNumber: bigint,
): Promise<{ hash: string }> {
  const args: xdr.ScVal[] = [
    new Address(publicKey).toScVal(),
    scvBytes(batchIdHex),
    scvU64(serialNumber),
  ];
  const { hash } = await invoke(publicKey, "register_ownership_receipt", args);
  return { hash };
}

export async function registerBatch(
  publicKey: string,
  input: RegisterBatchInput,
): Promise<{ hash: string }> {
  const args: xdr.ScVal[] = [
    new Address(publicKey).toScVal(),
    scvBytes(input.batchIdHex),
    scvString(input.productName),
    scvU64(input.serialRangeStart),
    scvU64(input.serialRangeEnd),
    scvU64(input.manufacturedDate),
  ];
  const { hash } = await invoke(publicKey, "register_batch", args);
  return { hash };
}

export async function issueRecall(
  publicKey: string,
  input: IssueRecallInput,
): Promise<{ hash: string }> {
  const args: xdr.ScVal[] = [
    new Address(publicKey).toScVal(),
    scvBytes(input.batchIdHex),
    scvSeverity(input.severity),
    scvBytes(input.messageHashHex),
    scvU64(input.affectedSerialStart),
    scvU64(input.affectedSerialEnd),
  ];
  const { hash } = await invoke(publicKey, "issue_recall", args);
  return { hash };
}

export function randomBatchId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("hex");
}

function decodeOptionalU64(scv: xdr.ScVal): bigint | null {
  if (scv.switch().name === "scvVoid") {
    return null;
  }
  return BigInt(scv.u64().toString());
}

function decodeBytesVec(scv: xdr.ScVal): string[] {
  const elements = scv.vec();
  if (!elements) {
    return [];
  }
  return elements.map((value) => Buffer.from(value.bytes()).toString("hex"));
}

/**
 * Simulates a read-only contract call against the registry. Nothing is
 * submitted and no fees are paid. Used by the dashboard to resolve the
 * caller's on-chain manufacturer identity and batch list.
 */
async function simulateRead(method: string, args: xdr.ScVal[]): Promise<xdr.ScVal> {
  const server = new rpc.Server(SOROBAN_RPC_URL);
  const source = Keypair.random();
  const account = new Account(source.publicKey(), "0");
  const contract = new Contract(CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
    sorobanData: new SorobanDataBuilder()
      .setFootprint([contract.getFootprint()], [])
      .build(),
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new TransactionSubmissionError(
      `${method} read simulation failed: ${simulation.error}`,
    );
  }
  if (!simulation.result) {
    throw new TransactionSubmissionError(`${method} returned no result`);
  }
  return simulation.result.retval;
}

export async function getManufacturerId(publicKey: string): Promise<bigint | null> {
  const retval = await simulateRead("get_manufacturer_id", [
    new Address(publicKey).toScVal(),
  ]);
  return decodeOptionalU64(retval);
}

export async function getBatchesForManufacturer(publicKey: string): Promise<string[]> {
  const retval = await simulateRead("get_batches_for_manufacturer", [
    new Address(publicKey).toScVal(),
  ]);
  return decodeBytesVec(retval);
}

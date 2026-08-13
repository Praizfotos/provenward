import {
  Account,
  BASE_FEE,
  Contract,
  Keypair,
  SorobanDataBuilder,
  TransactionBuilder,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";

import { config } from "../config";
import { logger } from "../logger";
import {
  hexToScvBytes,
  scvU64,
  Recall,
  decodeRecallVec,
  VerificationResult,
  decodeVerificationResult,
} from "../scval";

export class ContractCallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractCallError";
  }
}

/**
 * Read-only client for the deployed Provenward contract. Every call is a
 * simulated invoke host function transaction — nothing is submitted and no
 * fees are paid. This is the only path the backend uses to touch the ledger.
 */
export class ProvenwardContract {
  private readonly server: rpc.Server;
  private readonly contract: Contract;
  private readonly networkPassphrase: string;

  constructor(
    rpcUrl = config.SOROBAN_RPC_URL,
    contractId = config.CONTRACT_ID,
    networkPassphrase = config.STELLAR_NETWORK_PASSPHRASE,
  ) {
    this.server = new rpc.Server(rpcUrl);
    this.contract = new Contract(contractId);
    this.networkPassphrase = networkPassphrase;
  }

  async getNetworkPassphrase(): Promise<string> {
    const network = await this.server.getNetwork();
    return network.passphrase;
  }

  async verifySerial(batchIdHex: string, serialNumber: bigint): Promise<VerificationResult> {
    const retval = await this.simulate(
      "verify_serial",
      [hexToScvBytes(batchIdHex), scvU64(serialNumber)],
    );
    return decodeVerificationResult(retval);
  }

  async getRecallsForBatch(batchIdHex: string): Promise<Recall[]> {
    const retval = await this.simulate("get_recalls_for_batch", [
      hexToScvBytes(batchIdHex),
    ]);
    return decodeRecallVec(retval);
  }

  private async simulate(method: string, args: xdr.ScVal[]): Promise<xdr.ScVal> {
    const source = Keypair.random();
    const account = new Account(source.publicKey(), "0");

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
      sorobanData: new SorobanDataBuilder()
        .setFootprint([this.contract.getFootprint()], [])
        .build(),
    })
      .addOperation(this.contract.call(method, ...args))
      .setTimeout(30)
      .build();

    try {
      const sim = await this.server.simulateTransaction(tx);
      if (rpc.Api.isSimulationError(sim)) {
        throw new ContractCallError(`${method} simulation failed: ${sim.error}`);
      }
      if (sim.result) {
        return sim.result.retval;
      }
      throw new ContractCallError(`${method} simulation returned no result`);
    } catch (error) {
      if (error instanceof ContractCallError) {
        throw error;
      }
      logger.error({ method, error }, "contract simulation failed");
      throw new ContractCallError(
        `contract ${method} call failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

import { prisma } from "../db/client";
import { ProvenwardContract } from "./contract";
import { VerificationResult } from "../scval";

export interface VerifyOutcome {
  result: VerificationResult;
  fromContract: boolean;
}

/**
 * Verifies a serial against the contract, falling back to the indexed DB copy
 * of the batch when the RPC is unreachable. The DB fallback is only as fresh
 * as the last indexer run, so callers should prefer the on-chain result.
 */
export async function verifySerialWithFallback(
  contract: ProvenwardContract,
  batchId: string,
  serial: bigint,
): Promise<VerifyOutcome> {
  try {
    const result = await contract.verifySerial(batchId, serial);
    return { result, fromContract: true };
  } catch {
    const batch = await prisma.batch.findUnique({
      where: { batchId },
      include: { manufacturer: true },
    });
    if (!batch) {
      return { result: { status: "not_found" }, fromContract: false };
    }
    if (
      serial < batch.serialRangeStart ||
      serial > batch.serialRangeEnd
    ) {
      return { result: { status: "out_of_range" }, fromContract: false };
    }
    return {
      result: {
        status: "genuine",
        details: {
          manufacturer: batch.manufacturer.address,
          productName: batch.productName,
          manufacturedDate: BigInt(Math.floor(batch.manufacturedDate.getTime() / 1000)),
        },
      },
      fromContract: false,
    };
  }
}
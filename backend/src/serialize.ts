import { Recall, VerificationResult } from "./scval";

export function recallToJson(recall: Recall): Record<string, unknown> {
  return {
    id: recall.id,
    batchId: `0x${recall.batchId}`,
    manufacturer: recall.manufacturer,
    severity: recall.severity,
    messageHash: `0x${recall.messageHash}`,
    affectedSerialStart: recall.affectedSerialStart.toString(),
    affectedSerialEnd: recall.affectedSerialEnd.toString(),
    issuedAt: recall.issuedAt.toString(),
  };
}

export function verificationResultToJson(
  result: VerificationResult,
): Record<string, unknown> {
  switch (result.status) {
    case "genuine":
      return {
        status: "genuine",
        details: {
          manufacturer: result.details.manufacturer,
          productName: result.details.productName,
          manufacturedDate: result.details.manufacturedDate.toString(),
        },
      };
    case "not_found":
      return { status: "not_found", details: null };
    case "out_of_range":
      return { status: "out_of_range", details: null };
  }
}
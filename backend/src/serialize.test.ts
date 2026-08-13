import { Keypair } from "@stellar/stellar-sdk";
import { recallToJson, verificationResultToJson } from "../src/serialize";
import { Recall, VerificationResult } from "../src/scval";

const manufacturer = Keypair.random().publicKey();

const recall: Recall = {
  id: 1,
  batchId: "ab".repeat(32),
  manufacturer,
  severity: "Critical",
  messageHash: "cd".repeat(32),
  affectedSerialStart: 10n,
  affectedSerialEnd: 20n,
  issuedAt: 1720000000n,
};

describe("recallToJson", () => {
  it("serializes bigints as strings and bytes as 0x-hex", () => {
    expect(recallToJson(recall)).toEqual({
      id: 1,
      batchId: `0x${"ab".repeat(32)}`,
      manufacturer,
      severity: "Critical",
      messageHash: `0x${"cd".repeat(32)}`,
      affectedSerialStart: "10",
      affectedSerialEnd: "20",
      issuedAt: "1720000000",
    });
  });
});

describe("verificationResultToJson", () => {
  const genuine: VerificationResult = {
    status: "genuine",
    details: {
      manufacturer,
      productName: "Acme Widget",
      manufacturedDate: 1720000000n,
    },
  };

  it("serializes a genuine result with date as string", () => {
    expect(verificationResultToJson(genuine)).toEqual({
      status: "genuine",
      details: {
        manufacturer,
        productName: "Acme Widget",
        manufacturedDate: "1720000000",
      },
    });
  });

  it("serializes not_found and out_of_range arms", () => {
    expect(verificationResultToJson({ status: "not_found" })).toEqual({
      status: "not_found",
      details: null,
    });
    expect(verificationResultToJson({ status: "out_of_range" })).toEqual({
      status: "out_of_range",
      details: null,
    });
  });
});
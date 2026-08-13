import { Address, Keypair, StrKey, xdr } from "@stellar/stellar-sdk";
import {
  decodeContractEvent,
  decodeRecall,
  decodeRecallVec,
  decodeVerificationResult,
  hexToScvBytes,
  normalizeBatchId,
  scvAddressToString,
  scvU64,
  u64ToBigInt,
} from "../src/scval";

const s = xdr.ScVal;
const mkU64 = (n: bigint | string) => s.scvU64(xdr.Uint64.fromString(n.toString()));
const entry = (key: string, val: xdr.ScVal) =>
  new xdr.ScMapEntry({ key: s.scvSymbol(key), val });
const mkMap = (pairs: [string, xdr.ScVal][]) => s.scvMap(pairs.map(([k, v]) => entry(k, v)));
const bytes = (hex: string) => s.scvBytes(Buffer.from(hex, "hex"));

describe("normalizeBatchId / hexToScvBytes", () => {
  it("strips 0x prefix and lowercases", () => {
    expect(normalizeBatchId("0xABC123")).toBe("abc123");
    expect(normalizeBatchId("abc123")).toBe("abc123");
  });

  it("accepts a 32-byte hex value", () => {
    const hex = "ab".repeat(32);
    const scv = hexToScvBytes(hex);
    expect(scv.bytes().length).toBe(32);
  });

  it("rejects malformed values", () => {
    expect(() => hexToScvBytes("abc")).toThrow();
    expect(() => hexToScvBytes("zz".repeat(32))).toThrow();
  });
});

describe("u64 helpers", () => {
  it("round-trips a u64", () => {
    expect(u64ToBigInt(scvU64(12345678901234567890n))).toBe(12345678901234567890n);
  });
});

describe("scvAddressToString", () => {
  it("decodes an account address", () => {
    const account = Keypair.random().publicKey();
    const scv = s.scvAddress(new Address(account).toScAddress());
    expect(scvAddressToString(scv)).toBe(account);
  });

  it("decodes a contract address", () => {
    const contractId = Buffer.from("ab".repeat(32), "hex");
    const scv = s.scvAddress(xdr.ScAddress.scAddressTypeContract(contractId));
    expect(scvAddressToString(scv)).toBe(StrKey.encodeContract(contractId));
  });
});

describe("decodeVerificationResult", () => {
  it("decodes Genuine", () => {
    const manufacturer = Keypair.random().publicKey();
    const scv = s.scvVec([
      s.scvSymbol("Genuine"),
      mkMap([
        ["manufacturer", s.scvAddress(new Address(manufacturer).toScAddress())],
        ["product_name", s.scvString("Acme Widget")],
        ["manufactured_date", mkU64(1720000000n)],
      ]),
    ]);
    expect(decodeVerificationResult(scv)).toEqual({
      status: "genuine",
      details: {
        manufacturer,
        productName: "Acme Widget",
        manufacturedDate: 1720000000n,
      },
    });
  });

  it("decodes Unregistered", () => {
    expect(decodeVerificationResult(s.scvVec([s.scvSymbol("Unregistered")]))).toEqual({
      status: "unregistered",
    });
  });

  it("decodes OutOfRange", () => {
    expect(decodeVerificationResult(s.scvVec([s.scvSymbol("OutOfRange")]))).toEqual({
      status: "out_of_range",
    });
  });
});

describe("decodeRecall / decodeRecallVec", () => {
  const recallScv = mkMap([
    ["id", mkU64(3n)],
    ["batch_id", bytes("cd".repeat(32))],
    ["manufacturer", s.scvAddress(new Address(Keypair.random().publicKey()).toScAddress())],
    ["severity", s.scvSymbol("Critical")],
    ["message_hash", bytes("ef".repeat(32))],
    ["affected_serial_start", mkU64(100n)],
    ["affected_serial_end", mkU64(200n)],
    ["issued_at", mkU64(1720000000n)],
  ]);

  it("decodes a single recall", () => {
    const recall = decodeRecall(recallScv);
    expect(recall.id).toBe(3);
    expect(recall.batchId).toBe("cd".repeat(32));
    expect(recall.severity).toBe("Critical");
    expect(recall.affectedSerialStart).toBe(100n);
    expect(recall.affectedSerialEnd).toBe(200n);
    expect(recall.issuedAt).toBe(1720000000n);
    expect(recall.messageHash).toBe("ef".repeat(32));
  });

  it("decodes a vector of recalls", () => {
    expect(decodeRecallVec(s.scvVec([recallScv, recallScv])).length).toBe(2);
  });
});

describe("decodeContractEvent", () => {
  const txHash = "0xhash";
  const closed = "2024-07-01T00:00:00Z";

  it("decodes ManufacturerRegistered", () => {
    const manufacturer = Keypair.random().publicKey();
    const topic = [s.scvSymbol("ManufacturerRegistered"), s.scvAddress(new Address(manufacturer).toScAddress()), mkU64(7n)];
    const data = mkMap([["name", s.scvString("Acme Corp")]]);
    const event = decodeContractEvent(topic, data, closed, txHash);
    expect(event).toEqual({
      type: "ManufacturerRegistered",
      manufacturer,
      manufacturerId: 7,
      name: "Acme Corp",
      ledgerClosedAt: closed,
      txHash,
    });
  });

  it("decodes BatchRegistered", () => {
    const manufacturer = Keypair.random().publicKey();
    const batchId = "ab".repeat(32);
    const topic = [s.scvSymbol("BatchRegistered"), s.scvAddress(new Address(manufacturer).toScAddress()), bytes(batchId)];
    const data = mkMap([
      ["product_name", s.scvString("Acme Widget")],
      ["serial_range_start", mkU64(1n)],
      ["serial_range_end", mkU64(100n)],
      ["manufactured_date", mkU64(1720000000n)],
    ]);
    const event = decodeContractEvent(topic, data, closed, txHash);
    expect(event).toEqual({
      type: "BatchRegistered",
      manufacturer,
      batchId,
      productName: "Acme Widget",
      serialRangeStart: 1n,
      serialRangeEnd: 100n,
      manufacturedDate: 1720000000n,
      ledgerClosedAt: closed,
      txHash,
    });
  });

  it("decodes RecallIssued", () => {
    const manufacturer = Keypair.random().publicKey();
    const batchId = "cd".repeat(32);
    const topic = [
      s.scvSymbol("RecallIssued"),
      bytes(batchId),
      mkU64(1n),
      s.scvSymbol("Warning"),
      s.scvAddress(new Address(manufacturer).toScAddress()),
    ];
    const data = mkMap([
      ["message_hash", bytes("ef".repeat(32))],
      ["affected_serial_start", mkU64(10n)],
      ["affected_serial_end", mkU64(20n)],
    ]);
    const event = decodeContractEvent(topic, data, closed, txHash);
    expect(event).toEqual({
      type: "RecallIssued",
      batchId,
      recallId: 1,
      severity: "Warning",
      manufacturer,
      messageHash: "ef".repeat(32),
      affectedSerialStart: 10n,
      affectedSerialEnd: 20n,
      ledgerClosedAt: closed,
      txHash,
    });
  });

  it("decodes OwnershipRegistered", () => {
    const owner = Keypair.random().publicKey();
    const batchId = "12".repeat(32);
    const topic = [s.scvSymbol("OwnershipRegistered"), s.scvAddress(new Address(owner).toScAddress()), bytes(batchId)];
    const data = mkMap([["serial_number", mkU64(42n)]]);
    const event = decodeContractEvent(topic, data, closed, txHash);
    expect(event).toEqual({
      type: "OwnershipRegistered",
      owner,
      batchId,
      serialNumber: 42n,
      ledgerClosedAt: closed,
      txHash,
    });
  });

  it("returns null for unknown topics", () => {
    expect(decodeContractEvent([s.scvSymbol("Unknown")], s.scvVoid(), closed, txHash)).toBeNull();
    expect(decodeContractEvent([s.scvString("NotASymbol")], s.scvVoid(), closed, txHash)).toBeNull();
  });
});

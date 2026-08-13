import { StrKey, xdr } from "@stellar/stellar-sdk";

export type Severity = "Info" | "Warning" | "Critical";

export interface GenuineDetails {
  manufacturer: string;
  productName: string;
  manufacturedDate: bigint;
}

export type VerificationResult =
  | { status: "genuine"; details: GenuineDetails }
  | { status: "not_found" }
  | { status: "out_of_range" };

export interface Recall {
  id: number;
  batchId: string;
  manufacturer: string;
  severity: Severity;
  messageHash: string;
  affectedSerialStart: bigint;
  affectedSerialEnd: bigint;
  issuedAt: bigint;
}

export type ParsedEvent =
  | {
      type: "ManufacturerRegistered";
      manufacturer: string;
      manufacturerId: number;
      name: string;
      ledgerClosedAt: string;
      txHash: string;
    }
  | {
      type: "BatchRegistered";
      manufacturer: string;
      batchId: string;
      productName: string;
      serialRangeStart: bigint;
      serialRangeEnd: bigint;
      manufacturedDate: bigint;
      ledgerClosedAt: string;
      txHash: string;
    }
  | {
      type: "RecallIssued";
      batchId: string;
      recallId: number;
      severity: Severity;
      manufacturer: string;
      messageHash: string;
      affectedSerialStart: bigint;
      affectedSerialEnd: bigint;
      ledgerClosedAt: string;
      txHash: string;
    }
  | {
      type: "OwnershipRegistered";
      owner: string;
      batchId: string;
      serialNumber: bigint;
      ledgerClosedAt: string;
      txHash: string;
    };

function isVec(scv: xdr.ScVal): boolean {
  return scv.switch().name === "scvVec";
}

function vecOrThrow(scv: xdr.ScVal): xdr.ScVal[] {
  const value = scv.vec();
  if (!value) {
    throw new Error("expected an ScVec, got void");
  }
  return value;
}

function bytesToString(value: string | Buffer): string {
  return Buffer.isBuffer(value) ? value.toString() : value;
}

export function normalizeBatchId(input: string): string {
  return input.replace(/^0x/, "").toLowerCase();
}

export function hexToScvBytes(hex: string): xdr.ScVal {
  const clean = normalizeBatchId(hex);
  if (!/^[0-9a-f]{64}$/.test(clean)) {
    throw new Error("batchId must be a 32-byte hex value");
  }
  return xdr.ScVal.scvBytes(Buffer.from(clean, "hex"));
}

export function scvU64(value: bigint): xdr.ScVal {
  return xdr.ScVal.scvU64(xdr.Uint64.fromString(value.toString()));
}

export function u64ToBigInt(scv: xdr.ScVal): bigint {
  return BigInt(scv.u64().toString());
}

export function scvBytesToHex(scv: xdr.ScVal): string {
  return Buffer.from(scv.bytes()).toString("hex");
}

export function scvToString(scv: xdr.ScVal): string {
  return bytesToString(scv.str());
}

export function scvSymbolToString(scv: xdr.ScVal): string {
  return bytesToString(scv.sym());
}

export function scvAddressToString(scv: xdr.ScVal): string {
  const address = scv.address();
  if (address.switch().name === "scAddressTypeAccount") {
    return StrKey.encodeEd25519PublicKey(address.accountId().ed25519());
  }
  return StrKey.encodeContract(address.contractId());
}

export function scvMapEntries(scv: xdr.ScVal): Map<string, xdr.ScVal> {
  const entries = scv.map();
  if (!entries) {
    throw new Error("expected an ScMap, got void");
  }
  return new Map(
    entries.map((entry) => [bytesToString(entry.key().sym()), entry.val()]),
  );
}

export function decodeVerificationResult(scv: xdr.ScVal): VerificationResult {
  if (!isVec(scv)) {
    throw new Error(`unexpected VerificationResult arm: ${scv.switch().name}`);
  }
  const elements = vecOrThrow(scv);
  const variant = bytesToString(elements[0].sym());
  switch (variant) {
    case "NotFound":
      return { status: "not_found" };
    case "OutOfRange":
      return { status: "out_of_range" };
    case "Genuine": {
      const map = scvMapEntries(elements[1]);
      return {
        status: "genuine",
        details: {
          manufacturer: scvAddressToString(map.get("manufacturer") as xdr.ScVal),
          productName: scvToString(map.get("product_name") as xdr.ScVal),
          manufacturedDate: u64ToBigInt(map.get("manufactured_date") as xdr.ScVal),
        },
      };
    }
    default:
      throw new Error(`unknown VerificationResult variant: ${variant}`);
  }
}

export function decodeRecall(scv: xdr.ScVal): Recall {
  const map = scvMapEntries(scv);
  return {
    id: Number(u64ToBigInt(map.get("id") as xdr.ScVal)),
    batchId: scvBytesToHex(map.get("batch_id") as xdr.ScVal),
    manufacturer: scvAddressToString(map.get("manufacturer") as xdr.ScVal),
    severity: bytesToString(
      (map.get("severity") as xdr.ScVal).sym(),
    ) as Severity,
    messageHash: scvBytesToHex(map.get("message_hash") as xdr.ScVal),
    affectedSerialStart: u64ToBigInt(map.get("affected_serial_start") as xdr.ScVal),
    affectedSerialEnd: u64ToBigInt(map.get("affected_serial_end") as xdr.ScVal),
    issuedAt: u64ToBigInt(map.get("issued_at") as xdr.ScVal),
  };
}

export function decodeRecallVec(scv: xdr.ScVal): Recall[] {
  if (!isVec(scv)) {
    throw new Error(`unexpected Recall list arm: ${scv.switch().name}`);
  }
  return vecOrThrow(scv).map(decodeRecall);
}

export function decodeContractEvent(
  topic: xdr.ScVal[],
  data: xdr.ScVal,
  ledgerClosedAt: string,
  txHash: string,
): ParsedEvent | null {
  const [name, ...rest] = topic;
  if (!name || name.switch().name !== "scvSymbol") {
    return null;
  }
  const eventName = bytesToString(name.sym());

  switch (eventName) {
    case "ManufacturerRegistered":
      return {
        type: "ManufacturerRegistered",
        manufacturer: scvAddressToString(rest[0]),
        manufacturerId: Number(u64ToBigInt(rest[1])),
        name: scvToString(scvMapEntries(data).get("name") as xdr.ScVal),
        ledgerClosedAt,
        txHash,
      };
    case "BatchRegistered":
      return {
        type: "BatchRegistered",
        manufacturer: scvAddressToString(rest[0]),
        batchId: scvBytesToHex(rest[1]),
        productName: scvToString(
          scvMapEntries(data).get("product_name") as xdr.ScVal,
        ),
        serialRangeStart: u64ToBigInt(
          scvMapEntries(data).get("serial_range_start") as xdr.ScVal,
        ),
        serialRangeEnd: u64ToBigInt(
          scvMapEntries(data).get("serial_range_end") as xdr.ScVal,
        ),
        manufacturedDate: u64ToBigInt(
          scvMapEntries(data).get("manufactured_date") as xdr.ScVal,
        ),
        ledgerClosedAt,
        txHash,
      };
    case "RecallIssued": {
      const map = scvMapEntries(data);
      return {
        type: "RecallIssued",
        batchId: scvBytesToHex(rest[0]),
        recallId: Number(u64ToBigInt(rest[1])),
        severity: bytesToString(rest[2].sym()) as Severity,
        manufacturer: scvAddressToString(rest[3]),
        messageHash: scvBytesToHex(map.get("message_hash") as xdr.ScVal),
        affectedSerialStart: u64ToBigInt(
          map.get("affected_serial_start") as xdr.ScVal,
        ),
        affectedSerialEnd: u64ToBigInt(
          map.get("affected_serial_end") as xdr.ScVal,
        ),
        ledgerClosedAt,
        txHash,
      };
    }
    case "OwnershipRegistered":
      return {
        type: "OwnershipRegistered",
        owner: scvAddressToString(rest[0]),
        batchId: scvBytesToHex(rest[1]),
        serialNumber: u64ToBigInt(
          scvMapEntries(data).get("serial_number") as xdr.ScVal,
        ),
        ledgerClosedAt,
        txHash,
      };
    default:
      return null;
  }
}
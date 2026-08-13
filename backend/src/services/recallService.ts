import { prisma } from "../db/client";
import { ProvenwardContract } from "./contract";
import { Recall, Severity } from "../scval";

export interface RecallSummary {
  count: number;
  critical: number;
  warning: number;
  info: number;
}

export function summarizeRecalls(recalls: Recall[]): RecallSummary {
  const summary: RecallSummary = { count: recalls.length, critical: 0, warning: 0, info: 0 };
  for (const recall of recalls) {
    summary[recall.severity.toLowerCase() as "critical" | "warning" | "info"] += 1;
  }
  return summary;
}

/**
 * Returns recalls for a batch, preferring the indexed DB copy and merging in
 * anything the contract reports that the indexer has not caught up to yet.
 * When `serial` is given, only recalls whose affected range covers the serial
 * are returned. Result is sorted by recall id ascending and deduplicated.
 */
export async function getRecallsForBatch(
  contract: ProvenwardContract,
  batchId: string,
  serial?: bigint,
): Promise<Recall[]> {
  const byId = new Map<number, Recall>();

  try {
    const onChain = await contract.getRecallsForBatch(batchId);
    for (const recall of onChain) {
      byId.set(recall.id, recall);
    }
  } catch {
    // RPC unavailable — the DB copy below is the fallback.
  }

  const indexed = await prisma.recall.findMany({
    where: { batchId },
    orderBy: { recallId: "asc" },
  });
  for (const row of indexed) {
    byId.set(row.recallId, {
      id: row.recallId,
      batchId: row.batchId,
      manufacturer: row.manufacturerAddress,
      severity: row.severity as Severity,
      messageHash: row.messageHash,
      affectedSerialStart: row.affectedSerialStart,
      affectedSerialEnd: row.affectedSerialEnd,
      issuedAt: BigInt(Math.floor(row.issuedAt.getTime() / 1000)),
    });
  }

  const recalls = [...byId.values()].sort((a, b) => a.id - b.id);
  if (serial === undefined) {
    return recalls;
  }
  return recalls.filter(
    (r) => serial >= r.affectedSerialStart && serial <= r.affectedSerialEnd,
  );
}
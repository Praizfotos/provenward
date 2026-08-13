import { rpc } from "@stellar/stellar-sdk";

import { config } from "./config";
import { prisma } from "./db/client";
import { logger } from "./logger";
import { decodeContractEvent, ParsedEvent } from "./scval";

const server = new rpc.Server(config.SOROBAN_RPC_URL);
const START_LEDGER = Number(process.env.INDEXER_START_LEDGER ?? 0);

async function readCursor(): Promise<number> {
  if (START_LEDGER > 0) {
    return START_LEDGER;
  }
  const row = await prisma.indexerCursor.findUnique({ where: { name: "main" } });
  if (row) {
    return row.ledger;
  }
  const latest = await server.getLatestLedger();
  return latest.sequence;
}

async function writeCursor(ledger: number): Promise<void> {
  await prisma.indexerCursor.upsert({
    where: { name: "main" },
    create: { name: "main", ledger },
    update: { ledger },
  });
}

function epochToDate(ledgerClosedAt: string): Date {
  return new Date(ledgerClosedAt);
}

function epochSecondsToDate(seconds: bigint): Date {
  return new Date(Number(seconds) * 1000);
}

async function handleEvent(event: ParsedEvent): Promise<void> {
  switch (event.type) {
    case "ManufacturerRegistered":
      await prisma.manufacturer.upsert({
        where: { onChainId: event.manufacturerId },
        create: {
          onChainId: event.manufacturerId,
          address: event.manufacturer,
          name: event.name,
          registeredAt: epochToDate(event.ledgerClosedAt),
        },
        update: {
          address: event.manufacturer,
          name: event.name,
          registeredAt: epochToDate(event.ledgerClosedAt),
        },
      });
      break;

    case "BatchRegistered": {
      let manufacturer =
        await prisma.manufacturer.findUnique({ where: { address: event.manufacturer } });
      if (!manufacturer) {
        // Defensive: the ManufacturerRegistered event for this address should
        // have been processed first because events are ordered by ledger.
        logger.warn(
          { manufacturer: event.manufacturer },
          "batch registered by unknown manufacturer, creating placeholder",
        );
        manufacturer = await prisma.manufacturer.create({
          data: { onChainId: 0, address: event.manufacturer, name: "unknown", registeredAt: epochToDate(event.ledgerClosedAt) },
        }).catch((error) => {
          logger.error({ error }, "failed to create placeholder manufacturer");
          return null;
        });
        if (!manufacturer) {
          return;
        }
      }
      await prisma.batch.upsert({
        where: { batchId: event.batchId },
        create: {
          batchId: event.batchId,
          manufacturerId: manufacturer.onChainId,
          productName: event.productName,
          serialRangeStart: event.serialRangeStart,
          serialRangeEnd: event.serialRangeEnd,
          manufacturedDate: epochSecondsToDate(event.manufacturedDate),
          registeredAt: epochToDate(event.ledgerClosedAt),
        },
        update: {
          manufacturerId: manufacturer.onChainId,
          productName: event.productName,
          serialRangeStart: event.serialRangeStart,
          serialRangeEnd: event.serialRangeEnd,
          manufacturedDate: epochSecondsToDate(event.manufacturedDate),
          registeredAt: epochToDate(event.ledgerClosedAt),
        },
      });
      break;
    }

    case "RecallIssued": {
      const batch = await prisma.batch.findUnique({ where: { batchId: event.batchId } });
      if (!batch) {
        logger.warn(
          { batchId: event.batchId },
          "recall for unknown batch, skipping until batch is indexed",
        );
        return;
      }
      await prisma.recall.upsert({
        where: { recallId: event.recallId },
        create: {
          recallId: event.recallId,
          batchId: event.batchId,
          manufacturerAddress: event.manufacturer,
          severity: event.severity,
          messageHash: event.messageHash,
          affectedSerialStart: event.affectedSerialStart,
          affectedSerialEnd: event.affectedSerialEnd,
          issuedAt: epochToDate(event.ledgerClosedAt),
        },
        update: {
          batchId: event.batchId,
          manufacturerAddress: event.manufacturer,
          severity: event.severity,
          messageHash: event.messageHash,
          affectedSerialStart: event.affectedSerialStart,
          affectedSerialEnd: event.affectedSerialEnd,
          issuedAt: epochToDate(event.ledgerClosedAt),
        },
      });
      break;
    }

    case "OwnershipRegistered":
      await prisma.ownershipReceipt
        .createMany({
          data: [
            {
              owner: event.owner,
              batchId: event.batchId,
              serialNumber: event.serialNumber,
              registeredAt: epochToDate(event.ledgerClosedAt),
            },
          ],
          skipDuplicates: true,
        })
        .catch((error) => {
          // A Foreign Key violation means the batch has not been indexed yet.
          logger.warn({ event: event.type, error }, "failed to index ownership receipt");
        });
      break;
  }
}

async function pollOnce(): Promise<void> {
  const cursor = await readCursor();

  let events: rpc.Api.EventResponse[] = [];
  let latestLedger = cursor;
  try {
    const response = await server.getEvents({
      startLedger: cursor + 1,
      limit: config.INDEXER_EVENT_LIMIT,
      filters: [{ type: "contract", contractIds: [config.CONTRACT_ID] }],
    });
    events = response.events;
    latestLedger = response.latestLedger;
  } catch (error) {
    logger.error({ error }, "getEvents failed");
    return;
  }

  let processed = cursor;
  for (const event of events) {
    if (!event.inSuccessfulContractCall) {
      continue;
    }
    const parsed = decodeContractEvent(
      event.topic,
      event.value,
      event.ledgerClosedAt,
      event.txHash,
    );
    if (!parsed) {
      continue;
    }
    try {
      await handleEvent(parsed);
    } catch (error) {
      logger.error({ event: parsed.type, error }, "failed to index event");
    }
    processed = Math.max(processed, event.ledger);
  }

  const nextCursor = events.length > 0 ? processed : latestLedger;
  await writeCursor(Math.max(nextCursor, cursor));
  logger.info(
    { cursor: nextCursor, events: events.length },
    "indexer poll complete",
  );
}

async function main(): Promise<void> {
  logger.info(
    { contractId: config.CONTRACT_ID, rpc: config.SOROBAN_RPC_URL },
    "indexer starting",
  );
  while (true) {
    await pollOnce();
    await new Promise((resolve) => setTimeout(resolve, config.INDEXER_POLL_INTERVAL_MS));
  }
}

main().catch((error) => {
  logger.error({ error }, "indexer crashed");
  process.exit(1);
});
import { prisma } from "./db/client";
import { config } from "./config";
import { logger } from "./logger";
import { sendEmail, sendWebhook, DeliveryTarget } from "./services/delivery";

async function processOne(recallId: number): Promise<void> {
  const recall = await prisma.recall.findUnique({
    where: { recallId },
    include: { batch: true },
  });
  if (!recall) {
    return;
  }

  const recipients = await prisma.ownershipReceipt.findMany({
    where: {
      batchId: recall.batchId,
      serialNumber: {
        gte: recall.affectedSerialStart,
        lte: recall.affectedSerialEnd,
      },
    },
  });
  const owners = [...new Set(recipients.map((r) => r.owner))];

  const preferences = await prisma.alertPreference.findMany({
    where: {
      owner: { in: owners },
      active: true,
      OR: [{ email: { not: null } }, { webhookUrl: { not: null } }],
    },
  });

  const target: DeliveryTarget = {
    recall: {
      id: recall.recallId,
      batchId: recall.batchId,
      manufacturer: recall.manufacturerAddress,
      severity: recall.severity,
      messageHash: recall.messageHash,
      affectedSerialStart: recall.affectedSerialStart,
      affectedSerialEnd: recall.affectedSerialEnd,
      issuedAt: BigInt(Math.floor(recall.issuedAt.getTime() / 1000)),
    },
    productName: recall.batch.productName,
    owner: "",
  };

  for (const prefs of preferences) {
    const alert = await prisma.recallAlert.upsert({
      where: { recallId_owner: { recallId: recall.recallId, owner: prefs.owner } },
      create: {
        recallId: recall.recallId,
        owner: prefs.owner,
        status: "pending",
      },
      update: {},
    });

    const deliveryTarget = { ...target, owner: prefs.owner };
    let delivered = false;
    let lastError: string | undefined;

    if (prefs.email) {
      try {
        await sendEmail(deliveryTarget, prefs.email);
        delivered = true;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
    if (prefs.webhookUrl) {
      try {
        await sendWebhook(deliveryTarget, prefs.webhookUrl);
        delivered = true;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    const status = delivered ? "delivered" : "failed";
    await prisma.recallAlert.update({
      where: { id: alert.id },
      data: {
        status,
        sentAt: delivered ? new Date() : null,
        error: lastError,
      },
    });
  }

  await prisma.recall.update({
    where: { recallId },
    data: { notified: true },
  });
  logger.info({ recallId, recipients: preferences.length }, "recall notifications processed");
}

async function pollOnce(): Promise<void> {
  const pending = await prisma.recall.findMany({
    where: { notified: false },
    orderBy: { recallId: "asc" },
    take: config.NOTIFIER_BATCH_SIZE,
  });

  for (const recall of pending) {
    try {
      await processOne(recall.recallId);
    } catch (error) {
      logger.error({ recallId: recall.recallId, error }, "notification job failed");
    }
  }
}

async function main(): Promise<void> {
  logger.info("notifier starting");
  while (true) {
    await pollOnce();
    await new Promise((resolve) => setTimeout(resolve, config.NOTIFIER_POLL_INTERVAL_MS));
  }
}

main().catch((error) => {
  logger.error({ error }, "notifier crashed");
  process.exit(1);
});
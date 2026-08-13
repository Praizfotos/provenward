import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db/client";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../middleware/errorHandler";

const manufacturerIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const manufacturerRoute = Router();

manufacturerRoute.get(
  "/api/manufacturers",
  asyncHandler(async (_req, res) => {
    const manufacturers = await prisma.manufacturer.findMany({
      orderBy: { onChainId: "asc" },
    });
    res.json({
      manufacturers: manufacturers.map((m) => ({
        id: m.onChainId,
        address: m.address,
        name: m.name,
        registeredAt: Math.floor(m.registeredAt.getTime() / 1000),
      })),
    });
  }),
);

manufacturerRoute.get(
  "/api/manufacturers/:id/batches",
  asyncHandler(async (req, res) => {
    const parsed = manufacturerIdSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new HttpError(400, "manufacturer id must be a positive integer");
    }
    const manufacturer = await prisma.manufacturer.findUnique({
      where: { onChainId: parsed.data.id },
      include: {
        batches: {
          orderBy: { registeredAt: "desc" },
          include: { _count: { select: { recalls: true } } },
        },
      },
    });
    if (!manufacturer) {
      throw new HttpError(404, "manufacturer not found");
    }
    res.json({
      manufacturer: {
        id: manufacturer.onChainId,
        address: manufacturer.address,
        name: manufacturer.name,
      },
      batches: manufacturer.batches.map((batch) => ({
        batchId: `0x${batch.batchId}`,
        productName: batch.productName,
        serialRangeStart: batch.serialRangeStart.toString(),
        serialRangeEnd: batch.serialRangeEnd.toString(),
        manufacturedDate: Math.floor(batch.manufacturedDate.getTime() / 1000),
        recallCount: batch._count.recalls,
      })),
    });
  }),
);

manufacturerRoute.get(
  "/api/manufacturers/:id/analytics",
  asyncHandler(async (req, res) => {
    const parsed = manufacturerIdSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new HttpError(400, "manufacturer id must be a positive integer");
    }
    const manufacturer = await prisma.manufacturer.findUnique({
      where: { onChainId: parsed.data.id },
      include: { batches: true },
    });
    if (!manufacturer) {
      throw new HttpError(404, "manufacturer not found");
    }

    const batchIds = manufacturer.batches.map((b) => b.batchId);
    const [scans, recalls] = await Promise.all([
      prisma.verificationScan.findMany({
        where: { batchId: { in: batchIds } },
      }),
      prisma.recall.findMany({
        where: { batchId: { in: batchIds } },
      }),
    ]);

    const outcomeCounts: Record<string, number> = {};
    for (const scan of scans) {
      outcomeCounts[scan.outcome] = (outcomeCounts[scan.outcome] ?? 0) + 1;
    }

    res.json({
      manufacturerId: manufacturer.onChainId,
      totalBatches: manufacturer.batches.length,
      totalScans: scans.length,
      genuineScans: outcomeCounts.genuine ?? 0,
      nonGenuineScans: (outcomeCounts.not_found ?? 0) + (outcomeCounts.out_of_range ?? 0),
      totalRecalls: recalls.length,
      criticalRecalls: recalls.filter((r) => r.severity === "Critical").length,
    });
  }),
);

export { manufacturerRoute as manufacturersRouter };

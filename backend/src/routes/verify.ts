import { Router } from "express";
import { z } from "zod";

import { config } from "../config";
import { prisma } from "../db/client";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../middleware/errorHandler";
import { normalizeBatchId, VerificationResult } from "../scval";
import { recallToJson, verificationResultToJson } from "../serialize";
import { ProvenwardContract } from "../services/contract";
import { TtlCache } from "../services/cache";
import { getRecallsForBatch } from "../services/recallService";
import { verifySerialWithFallback } from "../services/verifyService";

const MAX_U64 = BigInt("0xFFFFFFFFFFFFFFFF");

const paramsSchema = z.object({
  batchId: z
    .string()
    .transform((value) => normalizeBatchId(value))
    .refine((value) => /^[0-9a-f]{64}$/.test(value), {
      message: "batchId must be a 32-byte hex value",
    }),
  serial: z
    .string()
    .regex(/^[0-9]+$/, "serial must be a non-negative integer")
    .transform((value) => {
      const parsed = BigInt(value);
      if (parsed > MAX_U64) {
        throw new Error("serial exceeds u64 range");
      }
      return parsed;
    }),
});

export function createVerifyRouter(
  contract: ProvenwardContract,
  cache = new TtlCache<VerificationResult>(config.VERIFY_CACHE_TTL_MS),
): Router {
  const router = Router();

  router.get(
    "/api/verify/:batchId/:serial",
    asyncHandler(async (req, res) => {
      const parsed = paramsSchema.safeParse(req.params);
      if (!parsed.success) {
        throw new HttpError(400, parsed.error.issues[0]?.message ?? "invalid params");
      }
      const { batchId, serial } = parsed.data;

      const cacheKey = `verify:${batchId}:${serial.toString()}`;
      let outcome = cache.get(cacheKey);
      if (!outcome) {
        outcome = (await verifySerialWithFallback(contract, batchId, serial)).result;
        cache.set(cacheKey, outcome);
      }

      const recalls = await getRecallsForBatch(contract, batchId, serial);

      prisma.verificationScan
        .create({
          data: {
            batchId,
            serialNumber: serial,
            outcome: outcome.status,
          },
        })
        .catch(() => {
          // Analytics is best-effort; a failed write must not break verification.
        });

      res.json({
        result: verificationResultToJson(outcome),
        recalls: recalls.map(recallToJson),
        cached: cacheKey !== undefined,
      });
    }),
  );

  return router;
}
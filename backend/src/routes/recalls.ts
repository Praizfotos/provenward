import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../middleware/errorHandler";
import { normalizeBatchId } from "../scval";
import { recallToJson } from "../serialize";
import { ProvenwardContract } from "../services/contract";
import { getRecallsForBatch, summarizeRecalls } from "../services/recallService";

const querySchema = z.object({
  batchId: z
    .string()
    .transform((value) => normalizeBatchId(value))
    .refine((value) => /^[0-9a-f]{64}$/.test(value), {
      message: "batchId must be a 32-byte hex value",
    }),
});

export function createRecallsRouter(contract: ProvenwardContract): Router {
  const router = Router();

  router.get(
    "/api/recalls",
    asyncHandler(async (req, res) => {
      const parsed = querySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new HttpError(400, parsed.error.issues[0]?.message ?? "invalid params");
      }
      const recalls = await getRecallsForBatch(contract, parsed.data.batchId);
      res.json({
        batchId: `0x${parsed.data.batchId}`,
        recalls: recalls.map(recallToJson),
        summary: summarizeRecalls(recalls),
      });
    }),
  );

  return router;
}
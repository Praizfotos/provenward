import { Router } from "express";
import { Prisma } from "@prisma/client";

import { config } from "../config";
import { prisma } from "../db/client";
import { asyncHandler } from "../middleware/asyncHandler";

export function createHealthRouter(): Router {
  const router = Router();

  router.get(
    "/health",
    asyncHandler(async (_req, res) => {
      let db = true;
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch {
        db = false;
      }
      res.json({
        status: db ? "ok" : "degraded",
        db,
        contractId: config.CONTRACT_ID,
        rpc: config.SOROBAN_RPC_URL,
      });
    }),
  );

  return router;
}

export function isPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db/client";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../middleware/errorHandler";
import { StrKey } from "@stellar/stellar-sdk";
import {
  buildMessage,
  maskEmail,
  verifyMessageSignature,
} from "../services/alertService";

const upsertSchema = z
  .object({
    owner: z
      .string()
      .refine((value) => StrKey.isValidEd25519PublicKey(value), {
        message: "owner must be a valid Stellar G... address",
      }),
    email: z.string().email().nullable().optional(),
    webhookUrl: z.string().url().nullable().optional(),
    signature: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    if (!data.email && !data.webhookUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "provide at least one of email or webhookUrl",
        path: ["email"],
      });
    }
  });

const ownerSchema = z.object({
  owner: z
    .string()
    .refine((value) => StrKey.isValidEd25519PublicKey(value), {
      message: "owner must be a valid Stellar G... address",
    }),
});

const alertPreferencesRouter = Router();

alertPreferencesRouter.get(
  "/api/alert-preferences/:owner",
  asyncHandler(async (req, res) => {
    const parsed = ownerSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new HttpError(400, "owner must be a valid Stellar G... address");
    }
    const prefs = await prisma.alertPreference.findUnique({
      where: { owner: parsed.data.owner },
    });
    res.json({
      owner: parsed.data.owner,
      active: prefs?.active ?? false,
      email: prefs ? maskEmail(prefs.email) : null,
      webhookEnabled: Boolean(prefs?.webhookUrl),
    });
  }),
);

alertPreferencesRouter.post(
  "/api/alert-preferences",
  asyncHandler(async (req, res) => {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "invalid body");
    }
    const { owner, email, webhookUrl, signature } = parsed.data;

    if (!verifyMessageSignature({ owner, email: email ?? null, webhookUrl: webhookUrl ?? null }, signature)) {
      throw new HttpError(401, "signature verification failed");
    }

    const prefs = await prisma.alertPreference.upsert({
      where: { owner },
      create: {
        owner,
        email: email ?? null,
        webhookUrl: webhookUrl ?? null,
        active: true,
      },
      update: {
        email: email ?? null,
        webhookUrl: webhookUrl ?? null,
        active: true,
      },
    });

    res.json({
      ok: true,
      prefs: {
        active: prefs.active,
        email: maskEmail(prefs.email),
        webhookEnabled: Boolean(prefs.webhookUrl),
      },
    });
  }),
);

export { alertPreferencesRouter };

export function messageToSign(params: { owner: string; email?: string | null; webhookUrl?: string | null }) {
  return buildMessage({
    owner: params.owner,
    email: params.email ?? null,
    webhookUrl: params.webhookUrl ?? null,
  });
}
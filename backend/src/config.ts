import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().default(
    "postgresql://provenward:provenward@localhost:5432/provenward",
  ),
  SOROBAN_RPC_URL: z
    .string()
    .default("https://soroban-testnet.stellar.org:443"),
  CONTRACT_ID: z.string().min(1),
  STELLAR_NETWORK_PASSPHRASE: z
    .string()
    .default("Test SDF Network ; September 2015"),
  SOURCE_ACCOUNT: z.string().optional(),
  INDEXER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(10_000),
  INDEXER_EVENT_LIMIT: z.coerce.number().int().positive().default(100),
  NOTIFIER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  NOTIFIER_BATCH_SIZE: z.coerce.number().int().positive().default(20),
  VERIFY_CACHE_TTL_MS: z.coerce.number().int().nonnegative().default(60_000),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("Provenward <no-reply@provenward.local>"),
  LOG_LEVEL: z.string().default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;

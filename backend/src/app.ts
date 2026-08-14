import express from "express";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";

import { logger } from "./logger";
import { errorHandler } from "./middleware/errorHandler";
import { ProvenwardContract } from "./services/contract";
import { createHealthRouter } from "./routes/health";
import { createVerifyRouter } from "./routes/verify";
import { createRecallsRouter } from "./routes/recalls";
import { manufacturersRouter } from "./routes/manufacturers";
import { alertPreferencesRouter } from "./routes/alertPreferences";

export function createApp(
  contract: ProvenwardContract = new ProvenwardContract(),
): express.Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === "/health" },
    }),
  );

  // Per-IP rate limit protects the public verification/recall endpoints from
  // abusive scanning and keeps the simulated RPC reads within reasonable bounds.
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 100,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
  );

  app.use(createHealthRouter());
  app.use(createVerifyRouter(contract));
  app.use(createRecallsRouter(contract));
  app.use(manufacturersRouter);
  app.use(alertPreferencesRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "not_found", message: "Route not found." });
  });

  app.use(errorHandler);

  return app;
}
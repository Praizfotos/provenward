import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "../logger";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: "invalid_request",
      message: "Request validation failed.",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({ error: "request_error", message: error.message });
    return;
  }

  logger.error({ error, path: req.path }, "unhandled error");
  res.status(500).json({ error: "internal", message: "Internal server error." });
};
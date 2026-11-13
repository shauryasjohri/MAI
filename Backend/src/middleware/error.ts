import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "../lib/errors.js";
import { env } from "../config/env.js";

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not found" });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;

  if (env.NODE_ENV !== "test" && statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    error: isAppError ? err.message : "Internal server error"
  });
};

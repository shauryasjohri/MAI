import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pino from "pino";
import { pinoHttp } from "pino-http";
import authRoutes from "./routes/auth.js";
import chatRoutes from "./routes/chat.js";
import documentRoutes from "./routes/documents.js";
import { corsOrigins, env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/error.js";

const createApp = () => {
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true
    })
  );
  app.use(express.json({ limit: "64kb" }));
  app.use(cookieParser());

  if (env.NODE_ENV !== "test") {
    const logger = pino({
      level: env.NODE_ENV === "production" ? "info" : "debug",
      redact: ["req.headers.cookie", "req.headers.authorization"]
    });
    app.use(pinoHttp({ logger }));
  }

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/documents", documentRoutes);
  app.use("/api", chatRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};

export const app = createApp();

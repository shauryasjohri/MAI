import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";

interface TokenPayload {
  sub: string;
  email: string;
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const token = req.cookies?.[env.COOKIE_NAME] ?? bearer;

  if (!token) {
    return next(new AppError(401, "Authentication required"));
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;

    if (!payload.sub || !payload.email) {
      throw new Error("Malformed token");
    }

    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    next(new AppError(401, "Invalid or expired session"));
  }
};

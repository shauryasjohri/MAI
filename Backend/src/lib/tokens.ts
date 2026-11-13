import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const signToken = (user: { id: string; email: string }): string =>
  jwt.sign({ email: user.email }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]
  });

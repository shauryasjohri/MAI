import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  COOKIE_NAME: z.string().default("mai_token"),
  COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).optional(),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  RAG_TOP_K: z.coerce.number().int().positive().default(5),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(10),
  MAX_DOCUMENTS_PER_THREAD: z.coerce.number().int().positive().default(5),
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  GOOGLE_REDIRECT_URI: z.string().default("http://localhost:8080/api/auth/google/callback"),
  OAUTH_SUCCESS_REDIRECT: z.string().default("")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

const isProduction = env.NODE_ENV === "production";

export const corsOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const oauthSuccessRedirect =
  env.OAUTH_SUCCESS_REDIRECT || corsOrigins[0] || "http://localhost:5173";

export const isGoogleOAuthConfigured = Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
);

export const cookieSecure = env.COOKIE_SECURE
  ? env.COOKIE_SECURE === "true"
  : isProduction;

export const cookieSameSite =
  env.COOKIE_SAME_SITE ?? (cookieSecure ? "none" : "lax");

export const cookieOptions = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: cookieSameSite as "none" | "lax" | "strict",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000
};

import type { ZodType } from "zod";
import { AppError } from "./errors.js";

export const parse = <T>(schema: ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);

  if (!result.success) {
    const issue = result.error.issues[0];
    throw new AppError(400, issue?.message ?? "Invalid request");
  }

  return result.data;
};

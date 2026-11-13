import { z } from "zod";

export const chatBodySchema = z.object({
  threadId: z.string().uuid("threadId must be a valid UUID"),
  message: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(4000, "Message must be under 4000 characters")
});

export const threadIdSchema = z.object({
  threadId: z.string().uuid("threadId must be a valid UUID")
});

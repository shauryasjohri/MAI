import { z } from "zod";

export const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address")
    .max(254, "Email is too long"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be under 72 characters")
});

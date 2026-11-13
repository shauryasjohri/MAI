import OpenAI from "openai";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";

const client = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  timeout: env.OPENAI_TIMEOUT_MS,
  maxRetries: 1
});

const BATCH_SIZE = 64;

const toAppError = (err: unknown): AppError => {
  if (err instanceof AppError) return err;

  if (err instanceof OpenAI.APIError) {
    if (err.status === 429) {
      return new AppError(429, "The embedding service is busy or out of quota. Please try again later.");
    }
    return new AppError(502, "The embedding service is temporarily unavailable. Please try again.");
  }

  return new AppError(502, "The embedding service is temporarily unavailable. Please try again.");
};

export const embedTexts = async (texts: string[]): Promise<number[][]> => {
  if (texts.length === 0) {
    return [];
  }

  try {
    const embeddings: number[][] = [];

    for (let start = 0; start < texts.length; start += BATCH_SIZE) {
      const batch = texts.slice(start, start + BATCH_SIZE);
      const response = await client.embeddings.create({
        model: env.OPENAI_EMBEDDING_MODEL,
        input: batch
      });

      embeddings.push(...response.data.map((item) => item.embedding));
    }

    if (embeddings.length !== texts.length) {
      throw new AppError(502, "The embedding service returned an incomplete response.");
    }

    return embeddings;
  } catch (err) {
    throw toAppError(err);
  }
};

export const embedQuery = async (text: string): Promise<number[]> => {
  const [embedding] = await embedTexts([text]);
  return embedding ?? [];
};

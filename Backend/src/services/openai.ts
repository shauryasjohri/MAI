import OpenAI from "openai";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";

const SYSTEM_PROMPT =
  "You are MAI, a helpful assistant. Answer clearly and concisely, using markdown for code and lists.";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const client = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  timeout: env.OPENAI_TIMEOUT_MS,
  maxRetries: 1
});

const toOpenAIMessages = (
  history: ChatTurn[],
  context?: string
): OpenAI.Chat.ChatCompletionMessageParam[] => {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT }
  ];

  if (context) {
    messages.push({ role: "system", content: context });
  }

  messages.push(
    ...history.map((turn) => ({ role: turn.role, content: turn.content }))
  );

  return messages;
};

const toAppError = (err: unknown): AppError => {
  if (err instanceof AppError) return err;

  if (err instanceof OpenAI.APIError) {
    if (err.status === 429) {
      return new AppError(429, "The AI service is busy or out of quota. Please try again later.");
    }
    if (err.status === 401 || err.status === 403) {
      return new AppError(502, "The AI service rejected the server credentials.");
    }
    if (err instanceof OpenAI.APIConnectionTimeoutError) {
      return new AppError(504, "The AI service took too long to respond. Please try again.");
    }
    return new AppError(502, "The AI service is temporarily unavailable. Please try again.");
  }

  if (err instanceof Error && err.name === "AbortError") {
    return new AppError(499, "Request cancelled.");
  }

  return new AppError(502, "The AI service is temporarily unavailable. Please try again.");
};

export const getCompletion = async (
  history: ChatTurn[],
  context?: string
): Promise<string> => {
  try {
    const response = await client.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: toOpenAIMessages(history, context)
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new AppError(502, "The AI service returned an empty response.");
    }

    return content;
  } catch (err) {
    throw toAppError(err);
  }
};

export async function* streamCompletion(
  history: ChatTurn[],
  context?: string,
  signal?: AbortSignal
): AsyncGenerator<string> {
  try {
    const stream = await client.chat.completions.create(
      {
        model: env.OPENAI_MODEL,
        messages: toOpenAIMessages(history, context),
        stream: true
      },
      { signal }
    );

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  } catch (err) {
    throw toAppError(err);
  }
}

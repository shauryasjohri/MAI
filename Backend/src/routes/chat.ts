import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { Response } from "express";
import Thread, { type Message } from "../models/Thread.js";
import Document from "../models/Document.js";
import Chunk from "../models/Chunk.js";
import { getCompletion, streamCompletion, type ChatTurn } from "../services/openai.js";
import { getRagContext } from "../services/rag.js";
import { chatBodySchema, threadIdSchema } from "../schemas/chat.js";
import { parse } from "../lib/parse.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { env } from "../config/env.js";

const router = Router();

const MAX_HISTORY_MESSAGES = 20;

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === "test"
});

router.use(requireAuth);
router.use(chatLimiter);

const serializeMessage = (message: Message) => ({
  role: message.role,
  content: message.content,
  timestamp: message.timestamp ?? new Date()
});

const getContext = async (
  userId: string,
  threadId: string,
  question: string
): Promise<string | undefined> => {
  try {
    return (await getRagContext(userId, threadId, question)) ?? undefined;
  } catch (err) {
    console.error("RAG lookup failed", err);
    return undefined;
  }
};

const toHistory = (messages: Message[]): ChatTurn[] =>
  messages.slice(-MAX_HISTORY_MESSAGES).map((message) => ({
    role: message.role as ChatTurn["role"],
    content: message.content
  }));

const sendEvent = (res: Response, payload: unknown): void => {
  if (!res.writableEnded && !res.destroyed) {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
};

router.get("/thread", async (req, res) => {
  const threads = await Thread.find({ userId: req.user!.id })
    .sort({ updatedAt: -1 })
    .select("threadId title updatedAt");

  res.json(threads);
});

router.get("/thread/:threadId", async (req, res) => {
  const { threadId } = parse(threadIdSchema, req.params);

  const thread = await Thread.findOne({ userId: req.user!.id, threadId }).select("messages");

  if (!thread) {
    throw new AppError(404, "Thread not found");
  }

  res.json(thread.messages);
});

router.delete("/thread/:threadId", async (req, res) => {
  const { threadId } = parse(threadIdSchema, req.params);

  const deleted = await Thread.findOneAndDelete({ userId: req.user!.id, threadId });

  if (!deleted) {
    throw new AppError(404, "Thread not found");
  }

  await Promise.all([
    Document.deleteMany({ userId: req.user!.id, threadId }),
    Chunk.deleteMany({ userId: req.user!.id, threadId })
  ]);

  res.json({ success: "Thread deleted successfully" });
});

router.post("/chat", async (req, res) => {
  const { threadId, message } = parse(chatBodySchema, req.body);

  let thread = await Thread.findOne({ userId: req.user!.id, threadId });

  if (!thread) {
    thread = new Thread({
      userId: req.user!.id,
      threadId,
      title: message.slice(0, 60),
      messages: [{ role: "user", content: message }]
    });
  } else {
    thread.messages.push({ role: "user", content: message });
  }

  await thread.save();
  const userMessage = thread.messages[thread.messages.length - 1]!;

  const context = await getContext(req.user!.id, threadId, message);
  const assistantReply = await getCompletion(toHistory(thread.messages), context);

  thread.messages.push({ role: "assistant", content: assistantReply });
  await thread.save();

  const assistantMessage = thread.messages[thread.messages.length - 1]!;

  res.json({
    reply: assistantReply,
    userMessage: serializeMessage(userMessage),
    assistantMessage: serializeMessage(assistantMessage)
  });
});

router.post("/chat/stream", async (req, res) => {
  const { threadId, message } = parse(chatBodySchema, req.body);

  let thread = await Thread.findOne({ userId: req.user!.id, threadId });

  if (!thread) {
    thread = new Thread({
      userId: req.user!.id,
      threadId,
      title: message.slice(0, 60),
      messages: [{ role: "user", content: message }]
    });
  } else {
    thread.messages.push({ role: "user", content: message });
  }

  await thread.save();
  const userMessage = thread.messages[thread.messages.length - 1]!;

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  sendEvent(res, { type: "user", message: serializeMessage(userMessage) });

  const controller = new AbortController();
  res.on("close", () => controller.abort());

  let assistantReply = "";

  const context = await getContext(req.user!.id, threadId, message);

  try {
    for await (const delta of streamCompletion(toHistory(thread.messages), context, controller.signal)) {
      assistantReply += delta;
      sendEvent(res, { type: "delta", content: delta });
    }

    if (!assistantReply.trim()) {
      throw new AppError(502, "The AI service returned an empty response.");
    }

    thread.messages.push({ role: "assistant", content: assistantReply });
    await thread.save();

    const assistantMessage = thread.messages[thread.messages.length - 1]!;

    sendEvent(res, {
      type: "done",
      userMessage: serializeMessage(userMessage),
      assistantMessage: serializeMessage(assistantMessage)
    });
  } catch (err) {
    if (controller.signal.aborted) {
      return;
    }

    if (assistantReply.trim()) {
      thread.messages.push({ role: "assistant", content: assistantReply });
      await thread.save().catch(() => undefined);
    }

    sendEvent(res, {
      type: "error",
      error:
        err instanceof AppError
          ? err.message
          : "The AI service is temporarily unavailable. Please try again."
    });
  } finally {
    if (!res.writableEnded) {
      res.end();
    }
  }
});

export default router;

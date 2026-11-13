import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { Agent } from "supertest";

vi.mock("../services/openai.js", () => ({
  SYSTEM_PROMPT: "test-system-prompt",
  getCompletion: vi.fn(async (history: { content: string }[]) => {
    const last = history[history.length - 1];
    return `Echo: ${last?.content ?? ""}`;
  }),
  streamCompletion: vi.fn(async function* () {
    yield "Hello";
    yield " world";
  })
}));

vi.mock("../services/embeddings.js", () => ({
  embedTexts: vi.fn(async (texts: string[]) => texts.map(() => [1, 0, 0])),
  embedQuery: vi.fn(async () => [1, 0, 0])
}));

import { app } from "../app.js";
import Thread from "../models/Thread.js";
import Document from "../models/Document.js";
import Chunk from "../models/Chunk.js";
import User from "../models/User.js";
import { getCompletion } from "../services/openai.js";

let mongod: MongoMemoryServer;

const password = "password123";

const makeUser = async () => {
  const agent = request.agent(app);
  const email = `${crypto.randomUUID()}@example.com`;
  const res = await agent.post("/api/auth/register").send({ email, password });

  expect(res.status).toBe(201);

  return { agent, email };
};

const sendChat = (agent: Agent, threadId: string, message: string) =>
  agent.post("/api/chat").send({ threadId, message });

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
  vi.clearAllMocks();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe("health", () => {
  it("returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("auth", () => {
  it("registers a user and returns the session user", async () => {
    const agent = request.agent(app);
    const email = "new-user@example.com";

    const register = await agent.post("/api/auth/register").send({ email, password });
    expect(register.status).toBe(201);
    expect(register.body.user.email).toBe(email);

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);
  });

  it("rejects duplicate emails", async () => {
    const email = "duplicate@example.com";
    await request(app).post("/api/auth/register").send({ email, password });

    const res = await request(app).post("/api/auth/register").send({ email, password });
    expect(res.status).toBe(409);
  });

  it("rejects invalid credentials and short passwords", async () => {
    const badLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password });

    expect(badLogin.status).toBe(401);

    const weak = await request(app)
      .post("/api/auth/register")
      .send({ email: "weak@example.com", password: "short" });

    expect(weak.status).toBe(400);
  });

  it("logs out by clearing the session", async () => {
    const { agent } = await makeUser();

    const logout = await agent.post("/api/auth/logout");
    expect(logout.status).toBe(200);

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(401);
  });

  it("rejects unauthenticated thread access", async () => {
    const res = await request(app).get("/api/thread");
    expect(res.status).toBe(401);
  });

  it("reports OAuth providers and rejects unconfigured Google login", async () => {
    const providers = await request(app).get("/api/auth/providers");
    expect(providers.status).toBe(200);
    expect(providers.body).toEqual({ google: false });

    const google = await request(app).get("/api/auth/google");
    expect(google.status).toBe(503);
  });

  it("tells Google-only accounts to use Google sign-in", async () => {
    await User.create({ email: "google-only@example.com", googleId: "google-123" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "google-only@example.com", password });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain("Google");
  });
});

describe("chat", () => {
  it("validates the request body", async () => {
    const { agent } = await makeUser();

    const missing = await agent.post("/api/chat").send({ threadId: crypto.randomUUID() });
    expect(missing.status).toBe(400);

    const badId = await agent.post("/api/chat").send({ threadId: "not-a-uuid", message: "hi" });
    expect(badId.status).toBe(400);
  });

  it("stores a conversation and sends history to the model", async () => {
    const { agent } = await makeUser();
    const threadId = crypto.randomUUID();

    const first = await sendChat(agent, threadId, "What is Node.js?");
    expect(first.status).toBe(200);
    expect(first.body.reply).toBe("Echo: What is Node.js?");
    expect(first.body.userMessage.timestamp).toBeTruthy();

    const second = await sendChat(agent, threadId, "Explain more");
    expect(second.status).toBe(200);

    const history = vi.mocked(getCompletion).mock.calls.at(-1)?.[0];
    expect(history?.map((turn) => turn.content)).toEqual([
      "What is Node.js?",
      "Echo: What is Node.js?",
      "Explain more"
    ]);

    const thread = await Thread.findOne({ threadId });
    expect(thread?.messages).toHaveLength(4);
    expect(thread?.title).toBe("What is Node.js?");
  });

  it("scopes threads to the authenticated user", async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const threadId = crypto.randomUUID();

    await sendChat(owner.agent, threadId, "private conversation");

    const ownerList = await owner.agent.get("/api/thread");
    expect(ownerList.body).toHaveLength(1);

    const strangerList = await stranger.agent.get("/api/thread");
    expect(strangerList.body).toHaveLength(0);

    const strangerRead = await stranger.agent.get(`/api/thread/${threadId}`);
    expect(strangerRead.status).toBe(404);

    const strangerDelete = await stranger.agent.delete(`/api/thread/${threadId}`);
    expect(strangerDelete.status).toBe(404);
  });

  it("loads and deletes a thread", async () => {
    const { agent } = await makeUser();
    const threadId = crypto.randomUUID();

    await sendChat(agent, threadId, "keep me");

    const loaded = await agent.get(`/api/thread/${threadId}`);
    expect(loaded.status).toBe(200);
    expect(loaded.body).toHaveLength(2);

    const deleted = await agent.delete(`/api/thread/${threadId}`);
    expect(deleted.status).toBe(200);

    const missing = await agent.get(`/api/thread/${threadId}`);
    expect(missing.status).toBe(404);
  });

  it("streams tokens over SSE and persists the reply", async () => {
    const { agent } = await makeUser();
    const threadId = crypto.randomUUID();

    const res = await agent
      .post("/api/chat/stream")
      .send({ threadId, message: "stream please" })
      .buffer(true);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
    expect(res.text).toContain('"type":"user"');
    expect(res.text).toContain('"type":"delta","content":"Hello"');
    expect(res.text).toContain('"type":"delta","content":" world"');
    expect(res.text).toContain('"type":"done"');

    const thread = await Thread.findOne({ threadId });
    expect(thread?.messages.map((message) => message.content)).toEqual([
      "stream please",
      "Hello world"
    ]);
  });

  it("surfaces AI failures without corrupting the thread", async () => {
    const { agent } = await makeUser();
    const threadId = crypto.randomUUID();

    vi.mocked(getCompletion).mockRejectedValueOnce(new Error("upstream boom"));

    const res = await sendChat(agent, threadId, "will fail");
    expect(res.status).toBe(500);

    const thread = await Thread.findOne({ threadId });
    expect(thread?.messages).toHaveLength(1);
    expect(thread?.messages[0]?.content).toBe("will fail");
  });
});

describe("documents and RAG", () => {
  const uploadText = (
    agent: Agent,
    threadId: string,
    content = "MAI stands for My AI and helps with documents."
  ) =>
    agent
      .post("/api/documents")
      .field("threadId", threadId)
      .attach("file", Buffer.from(content), {
        filename: "notes.txt",
        contentType: "text/plain"
      });

  it("uploads, lists, and deletes a document with its chunks", async () => {
    const { agent } = await makeUser();
    const threadId = crypto.randomUUID();

    const upload = await uploadText(agent, threadId);
    expect(upload.status).toBe(201);
    expect(upload.body.document.filename).toBe("notes.txt");
    expect(upload.body.document.chunkCount).toBeGreaterThan(0);
    expect(await Chunk.countDocuments({ threadId })).toBeGreaterThan(0);

    const list = await agent.get(`/api/documents?threadId=${threadId}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const deleted = await agent.delete(`/api/documents/${upload.body.document.id}`);
    expect(deleted.status).toBe(200);
    expect(await Chunk.countDocuments({ threadId })).toBe(0);
  });

  it("validates file type and requires a file", async () => {
    const { agent } = await makeUser();
    const threadId = crypto.randomUUID();

    const missing = await agent.post("/api/documents").field("threadId", threadId);
    expect(missing.status).toBe(400);

    const badType = await agent
      .post("/api/documents")
      .field("threadId", threadId)
      .attach("file", Buffer.from("x"), {
        filename: "image.png",
        contentType: "image/png"
      });

    expect(badType.status).toBe(400);
  });

  it("scopes documents to the authenticated user", async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const threadId = crypto.randomUUID();

    const upload = await uploadText(owner.agent, threadId);

    const list = await stranger.agent.get(`/api/documents?threadId=${threadId}`);
    expect(list.body).toHaveLength(0);

    const deleted = await stranger.agent.delete(`/api/documents/${upload.body.document.id}`);
    expect(deleted.status).toBe(404);
  });

  it("deletes a thread's documents and chunks with the thread", async () => {
    const { agent } = await makeUser();
    const threadId = crypto.randomUUID();

    await sendChat(agent, threadId, "hello");
    await uploadText(agent, threadId);

    expect(await Document.countDocuments({ threadId })).toBe(1);

    const deleted = await agent.delete(`/api/thread/${threadId}`);
    expect(deleted.status).toBe(200);

    expect(await Document.countDocuments({ threadId })).toBe(0);
    expect(await Chunk.countDocuments({ threadId })).toBe(0);
  });

  it("adds retrieved document context to the chat prompt", async () => {
    const { agent } = await makeUser();
    const threadId = crypto.randomUUID();

    await uploadText(agent, threadId, "MAI stands for My AI and helps with documents.");

    const res = await sendChat(agent, threadId, "What does MAI stand for?");
    expect(res.status).toBe(200);

    const context = vi.mocked(getCompletion).mock.calls.at(-1)?.[1];
    expect(context).toContain("MAI stands for My AI");
  });
});

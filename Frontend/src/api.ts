import type { DocumentSummary, Message, ThreadSummary, User } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const readError = async (response: Response): Promise<string> => {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? `Request failed (${response.status})`;
};

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new ApiError(response.status, await readError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};

export const api = {
  async me(): Promise<User> {
    const data = await request<{ user: User }>("/api/auth/me");
    return data.user;
  },

  async register(email: string, password: string): Promise<User> {
    const data = await request<{ user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    return data.user;
  },

  async login(email: string, password: string): Promise<User> {
    const data = await request<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    return data.user;
  },

  async logout(): Promise<void> {
    await request<{ success: boolean }>("/api/auth/logout", { method: "POST" });
  },

  listThreads(): Promise<ThreadSummary[]> {
    return request<ThreadSummary[]>("/api/thread");
  },

  getThread(threadId: string): Promise<Message[]> {
    return request<Message[]>(`/api/thread/${threadId}`);
  },

  async deleteThread(threadId: string): Promise<void> {
    await request<{ success: string }>(`/api/thread/${threadId}`, { method: "DELETE" });
  },

  providers(): Promise<{ google: boolean }> {
    return request<{ google: boolean }>("/api/auth/providers");
  },

  googleLoginUrl(): string {
    return `${API_URL}/api/auth/google`;
  },

  async uploadDocument(threadId: string, file: File): Promise<DocumentSummary> {
    const form = new FormData();
    form.append("threadId", threadId);
    form.append("file", file);

    const response = await fetch(`${API_URL}/api/documents`, {
      method: "POST",
      credentials: "include",
      body: form
    });

    if (!response.ok) {
      throw new ApiError(response.status, await readError(response));
    }

    const data = (await response.json()) as { document: DocumentSummary };
    return data.document;
  },

  listDocuments(threadId: string): Promise<DocumentSummary[]> {
    return request<DocumentSummary[]>(`/api/documents?threadId=${encodeURIComponent(threadId)}`);
  },

  async deleteDocument(documentId: string): Promise<void> {
    await request<{ success: string }>(`/api/documents/${documentId}`, { method: "DELETE" });
  }
};

interface StreamCallbacks {
  onUser: (message: Message) => void;
  onDelta: (content: string) => void;
  onDone: (userMessage: Message, assistantMessage: Message) => void;
  onError: (message: string) => void;
}

interface StreamPayload {
  type: "user" | "delta" | "done" | "error";
  message?: Message;
  content?: string;
  userMessage?: Message;
  assistantMessage?: Message;
  error?: string;
}

export const streamChat = async (
  threadId: string,
  message: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> => {
  const response = await fetch(`${API_URL}/api/chat/stream`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threadId, message }),
    signal
  });

  if (!response.ok) {
    throw new ApiError(response.status, await readError(response));
  }

  if (!response.body) {
    throw new Error("Streaming is not supported in this browser.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleEvent = (raw: string): void => {
    const line = raw.split("\n").find((entry) => entry.startsWith("data:"));
    if (!line) return;

    let payload: StreamPayload;

    try {
      payload = JSON.parse(line.slice(5).trim()) as StreamPayload;
    } catch {
      return;
    }

    if (payload.type === "user" && payload.message) {
      callbacks.onUser(payload.message);
    } else if (payload.type === "delta" && payload.content) {
      callbacks.onDelta(payload.content);
    } else if (payload.type === "done" && payload.userMessage && payload.assistantMessage) {
      callbacks.onDone(payload.userMessage, payload.assistantMessage);
    } else if (payload.type === "error") {
      callbacks.onError(payload.error ?? "The AI service failed to respond.");
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      handleEvent(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
    }
  }
};

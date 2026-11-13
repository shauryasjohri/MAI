type MessageRole = "user" | "assistant";

export interface Message {
  role: MessageRole;
  content: string;
  timestamp: string;
}

export interface User {
  id: string;
  email: string;
}

export interface ThreadSummary {
  threadId: string;
  title: string;
  updatedAt: string;
}

export interface DocumentSummary {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  chunkCount: number;
  createdAt: string;
}

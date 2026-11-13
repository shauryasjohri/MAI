import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MyContext, type MyContextValue } from "../MyContext";
import type { Message } from "../types";
import Chat from "../Chat";

const renderChat = (overrides: Partial<MyContextValue> = {}) => {
  const value: MyContextValue = {
    user: { id: "user-1", email: "user@example.com" },
    setUser: vi.fn(),
    prompt: "",
    setPrompt: vi.fn(),
    prevChats: [],
    setPrevChats: vi.fn(),
    currThreadId: "thread-1",
    setCurrThreadId: vi.fn(),
    newChat: true,
    setNewChat: vi.fn(),
    allThreads: [],
    setAllThreads: vi.fn(),
    isStreaming: false,
    setIsStreaming: vi.fn(),
    darkMode: true,
    setDarkMode: vi.fn(),
    sidebarOpen: true,
    setSidebarOpen: vi.fn(),
    ...overrides
  };

  return render(
    <MyContext.Provider value={value}>
      <Chat />
    </MyContext.Provider>
  );
};

const messages: Message[] = [
  {
    role: "user",
    content: "What is Node.js?",
    timestamp: "2026-01-01T10:00:00.000Z"
  },
  {
    role: "assistant",
    content: "Node.js is a **JavaScript runtime**.",
    timestamp: "2026-01-01T10:00:05.000Z"
  }
];

describe("Chat", () => {
  it("shows the welcome screen for a new empty chat", () => {
    renderChat();

    expect(screen.getByText("Welcome to MAI")).toBeInTheDocument();
  });

  it("renders user and assistant messages with markdown", () => {
    renderChat({ newChat: false, prevChats: messages });

    expect(screen.getByText("What is Node.js?")).toBeInTheDocument();
    expect(screen.getByText("JavaScript runtime")).toBeInTheDocument();
    expect(screen.getAllByText("MAI").length).toBeGreaterThan(0);
  });

  it("shows a cursor while the assistant is streaming", () => {
    const streaming: Message[] = [
      messages[0]!,
      { role: "assistant", content: "Node.js is", timestamp: "2026-01-01T10:00:05.000Z" }
    ];

    const { container } = renderChat({
      newChat: false,
      prevChats: streaming,
      isStreaming: true
    });

    expect(container.querySelector(".streamCursor")).toBeInTheDocument();
  });
});

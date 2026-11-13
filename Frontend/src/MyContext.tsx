import { createContext, useContext } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Message, ThreadSummary, User } from "./types";

export interface MyContextValue {
  user: User | null;
  setUser: Dispatch<SetStateAction<User | null>>;
  prompt: string;
  setPrompt: Dispatch<SetStateAction<string>>;
  prevChats: Message[];
  setPrevChats: Dispatch<SetStateAction<Message[]>>;
  currThreadId: string;
  setCurrThreadId: Dispatch<SetStateAction<string>>;
  newChat: boolean;
  setNewChat: Dispatch<SetStateAction<boolean>>;
  allThreads: ThreadSummary[];
  setAllThreads: Dispatch<SetStateAction<ThreadSummary[]>>;
  isStreaming: boolean;
  setIsStreaming: Dispatch<SetStateAction<boolean>>;
  darkMode: boolean;
  setDarkMode: Dispatch<SetStateAction<boolean>>;
  sidebarOpen: boolean;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
}

export const MyContext = createContext<MyContextValue | undefined>(undefined);

export const useMyContext = (): MyContextValue => {
  const context = useContext(MyContext);

  if (!context) {
    throw new Error("useMyContext must be used within MyContext.Provider");
  }

  return context;
};

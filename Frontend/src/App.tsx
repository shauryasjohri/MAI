import './App.css';
import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from "uuid";
import { ScaleLoader } from "react-spinners";
import Sidebar from "./Sidebar";
import ChatWindow from "./ChatWindow";
import Auth from "./Auth";
import { MyContext, type MyContextValue } from "./MyContext";
import { api } from "./api";
import type { Message, ThreadSummary, User } from "./types";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [currThreadId, setCurrThreadId] = useState(uuidv4());
  const [prevChats, setPrevChats] = useState<Message[]>([]);
  const [newChat, setNewChat] = useState(true);
  const [allThreads, setAllThreads] = useState<ThreadSummary[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setDarkMode(savedTheme === 'dark');
    }
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
    } else {
      document.body.classList.add('light-mode');
      document.body.classList.remove('dark-mode');
    }
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    let active = true;

    api.me()
      .then((sessionUser) => {
        if (active) setUser(sessionUser);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setCheckingAuth(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setPrevChats([]);
    setAllThreads([]);
    setPrompt("");
    setNewChat(true);
    setCurrThreadId(uuidv4());
  }, [user?.id]);

  const providerValues: MyContextValue = {
    user, setUser,
    prompt, setPrompt,
    currThreadId, setCurrThreadId,
    newChat, setNewChat,
    prevChats, setPrevChats,
    allThreads, setAllThreads,
    isStreaming, setIsStreaming,
    darkMode, setDarkMode,
    sidebarOpen, setSidebarOpen
  };

  if (checkingAuth) {
    return (
      <div className="appLoading">
        <ScaleLoader color="#6366f1" />
      </div>
    );
  }

  if (!user) {
    return <Auth onAuth={setUser} />;
  }

  return (
    <div className='app'>
      <MyContext.Provider value={providerValues}>
        <Sidebar />
        <ChatWindow />
      </MyContext.Provider>
    </div>
  )
}

export default App

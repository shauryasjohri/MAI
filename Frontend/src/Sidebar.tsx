import "./Sidebar.css";
import { useCallback, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useMyContext } from "./MyContext";
import { api } from "./api";

function Sidebar() {
    const {
        user,
        setUser,
        allThreads, setAllThreads,
        currThreadId,
        setNewChat,
        setPrompt,
        setCurrThreadId,
        setPrevChats,
        sidebarOpen,
        setSidebarOpen
    } = useMyContext();

    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);

    const getAllThreads = useCallback(async () => {
        setLoading(true);
        try {
            const threads = await api.listThreads();
            setAllThreads(threads);
        } catch (err) {
            console.error("Error fetching threads:", err);
        } finally {
            setLoading(false);
        }
    }, [setAllThreads]);

    useEffect(() => {
        void getAllThreads();
    }, [currThreadId, getAllThreads]);

    const createNewChat = () => {
        setNewChat(true);
        setPrompt("");
        setCurrThreadId(uuidv4());
        setPrevChats([]);

        if (window.innerWidth < 768) {
            setSidebarOpen(false);
        }
    }

    const changeThread = async (newThreadId: string) => {
        setCurrThreadId(newThreadId);

        try {
            const messages = await api.getThread(newThreadId);
            setPrevChats(messages);
            setNewChat(false);

            if (window.innerWidth < 768) {
                setSidebarOpen(false);
            }
        } catch (err) {
            console.error("Error fetching thread:", err);
        }
    }

    const deleteThread = async (threadId: string) => {
        const confirmDelete = window.confirm("Are you sure you want to delete this conversation?");
        if (!confirmDelete) return;

        try {
            await api.deleteThread(threadId);
            setAllThreads((prev) => prev.filter((thread) => thread.threadId !== threadId));

            if (threadId === currThreadId) {
                createNewChat();
            }
        } catch (err) {
            console.error("Error deleting thread:", err);
            alert("Failed to delete conversation. Please try again.");
        }
    }

    const handleLogout = async () => {
        try {
            await api.logout();
        } catch {
            // Clear the local session even if the request fails.
        }
        setUser(null);
    }

    const filteredThreads = allThreads.filter((thread) =>
        thread.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDate = (date?: string) => {
        if (!date) return '';
        const parsed = new Date(date);
        const now = new Date();
        const diff = now.getTime() - parsed.getTime();

        if (diff < 86400000) {
            return 'Today';
        }
        if (diff < 172800000) {
            return 'Yesterday';
        }
        if (diff < 604800000) {
            return parsed.toLocaleDateString('en-US', { weekday: 'short' });
        }
        return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    return (
        <section className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
            <div className="sidebarHeader">
                <button className="newChatBtn" onClick={createNewChat} title="New chat">
                    <i className="fa-solid fa-plus"></i>
                    <span>New Chat</span>
                </button>
                
                <button 
                    className="closeSidebarBtn" 
                    onClick={() => setSidebarOpen(false)}
                    title="Close sidebar"
                    aria-label="Close sidebar"
                >
                    <i className="fa-solid fa-xmark"></i>
                </button>
            </div>

            <div className="searchBox">
                <i className="fa-solid fa-magnifying-glass"></i>
                <input 
                    type="text"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    aria-label="Search conversations"
                />
                {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="clearSearch" aria-label="Clear search">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                )}
            </div>

            <div className="historySection">
                <h3 className="historyTitle">
                    <i className="fa-solid fa-clock-rotate-left"></i>
                    Recent Chats
                </h3>
                
                {loading ? (
                    <div className="loadingThreads">
                        <i className="fa-solid fa-spinner fa-spin"></i>
                        <span>Loading...</span>
                    </div>
                ) : filteredThreads.length > 0 ? (
                    <ul className="history">
                        {filteredThreads.map((thread) => (
                            <li 
                                key={thread.threadId} 
                                onClick={() => void changeThread(thread.threadId)}
                                className={thread.threadId === currThreadId ? "highlighted" : ""}
                                title={thread.title}
                            >
                                <div className="threadContent">
                                    <i className="fa-solid fa-message"></i>
                                    <div className="threadInfo">
                                        <span className="threadTitle">{thread.title}</span>
                                        <span className="threadDate">{formatDate(thread.updatedAt)}</span>
                                    </div>
                                </div>
                                <button
                                    className="deleteBtn"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        void deleteThread(thread.threadId);
                                    }}
                                    title="Delete conversation"
                                    aria-label="Delete conversation"
                                >
                                    <i className="fa-solid fa-trash"></i>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="noThreads">
                        <i className="fa-solid fa-inbox"></i>
                        <p>{searchQuery ? "No conversations found" : "No conversations yet"}</p>
                    </div>
                )}
            </div>
 
            <div className="sidebarFooter">
                <div className="statsCard">
                    <div className="statItem">
                        <i className="fa-solid fa-comments"></i>
                        <span>{allThreads.length} Chats</span>
                    </div>
                </div>

                <div className="accountInfo" title={user?.email}>
                    <i className="fa-solid fa-user"></i>
                    <span>{user?.email}</span>
                </div>

                <button className="signOutBtn" onClick={() => void handleLogout()}>
                    <i className="fa-solid fa-right-from-bracket"></i>
                    Sign out
                </button>
            </div>
        </section>
    )
}

export default Sidebar;

import "./ChatWindow.css";
import Chat from "./Chat";
import { useMyContext } from "./MyContext";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { api, streamChat } from "./api";
import type { DocumentSummary } from "./types";

function ChatWindow() {
    const {
        prompt, setPrompt,
        currThreadId,
        setPrevChats,
        setNewChat,
        setUser,
        darkMode, setDarkMode,
        sidebarOpen, setSidebarOpen,
        isStreaming, setIsStreaming
    } = useMyContext();

    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [charCount, setCharCount] = useState(0);
    const [documents, setDocuments] = useState<DocumentSummary[]>([]);
    const [uploading, setUploading] = useState(false);
    const abortRef = useRef<AbortController | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        return () => {
            abortRef.current?.abort();
        };
    }, []);

    useEffect(() => {
        let active = true;

        api.listDocuments(currThreadId)
            .then((docs) => {
                if (active) setDocuments(docs);
            })
            .catch(() => {
                if (active) setDocuments([]);
            });

        return () => {
            active = false;
        };
    }, [currThreadId]);

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file || uploading) return;

        setUploading(true);
        setError(null);

        try {
            const document = await api.uploadDocument(currThreadId, file);
            setDocuments((prev) => [document, ...prev]);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to upload the document.");
        } finally {
            setUploading(false);
        }
    }

    const removeDocument = async (documentId: string) => {
        try {
            await api.deleteDocument(documentId);
            setDocuments((prev) => prev.filter((document) => document.id !== documentId));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to remove the document.");
        }
    }

    const getReply = async () => {
        const message = prompt.trim();
        if (!message || isStreaming) return;

        const now = new Date().toISOString();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setIsStreaming(true);
        setNewChat(false);
        setError(null);
        setPrompt("");
        setPrevChats((prev) => [
            ...prev,
            { role: "user", content: message, timestamp: now },
            { role: "assistant", content: "", timestamp: now }
        ]);

        try {
            await streamChat(
                currThreadId,
                message,
                {
                    onUser: (serverMessage) => {
                        setPrevChats((prev) => {
                            if (prev.length < 2) return prev;
                            const next = [...prev];
                            next[next.length - 2] = serverMessage;
                            return next;
                        });
                    },
                    onDelta: (delta) => {
                        setPrevChats((prev) => {
                            const last = prev[prev.length - 1];
                            if (!last || last.role !== "assistant") return prev;
                            const next = [...prev];
                            next[next.length - 1] = { ...last, content: last.content + delta };
                            return next;
                        });
                    },
                    onDone: (userMessage, assistantMessage) => {
                        setPrevChats((prev) => {
                            if (prev.length < 2) return [...prev, assistantMessage];
                            const next = [...prev];
                            next[next.length - 2] = userMessage;
                            next[next.length - 1] = assistantMessage;
                            return next;
                        });
                    },
                    onError: (message) => setError(message)
                },
                controller.signal
            );
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") {
                setError("Response stopped.");
            } else {
                setError(err instanceof Error ? err.message : "Failed to get response. Please try again.");
            }
        } finally {
            setPrevChats((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && last.content === "") {
                    return prev.slice(0, -1);
                }
                return prev;
            });
            abortRef.current = null;
            setLoading(false);
            setIsStreaming(false);
        }
    }

    const stopStreaming = () => {
        abortRef.current?.abort();
    }

    const handleLogout = async () => {
        try {
            await api.logout();
        } catch {
            // Clear the local session even if the request fails.
        }
        setUser(null);
    }

    useEffect(() => {
        setCharCount(prompt.length);
    }, [prompt]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (isOpen && !target.closest('.userIconDiv') && !target.closest('.dropDown')) {
                setIsOpen(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [isOpen]);

    const handleProfileClick = () => {
        setIsOpen(!isOpen);
    }

    const toggleTheme = () => {
        setDarkMode(!darkMode);
        setIsOpen(false);
    }

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    }

    const handleKeyPress = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void getReply();
        }
    }

    return (
        <div className="chatWindow">
            <div className="navbar">
                <div className="navLeft">
                    <button className="menuBtn" onClick={toggleSidebar} aria-label="Toggle sidebar">
                        <i className="fa-solid fa-bars"></i>
                    </button>
                    <span className="appTitle">
                        <i className="fa-solid fa-circle-dot"></i> MAI
                    </span>
                </div>

                <div className="navRight">
                    <button
                        className="themeToggle"
                        onClick={toggleTheme}
                        title="Toggle theme"
                        aria-label="Toggle theme"
                    >
                        <i className={`fa-solid fa-${darkMode ? 'moon' : 'sun'}`}></i>
                    </button>
                    <div className="userIconDiv" onClick={handleProfileClick}>
                        <span className="userIcon">
                            <i className="fa-solid fa-user"></i>
                        </span>
                    </div>
                </div>
            </div>

            {isOpen &&
                <div className="dropDown">
                    <div className="dropDownItem" onClick={toggleTheme}>
                        <i className={`fa-solid fa-${darkMode ? 'moon' : 'sun'}`}></i> 
                        {darkMode ? 'Light Mode' : 'Dark Mode'}
                    </div>
                    <div className="dropDownItem" onClick={() => void handleLogout()}>
                        <i className="fa-solid fa-right-from-bracket"></i> Sign out
                    </div>
                </div>
            }

            <Chat />

            {error && (
                <div className="errorMessage" role="alert">
                    <i className="fa-solid fa-circle-exclamation"></i>
                    <span>{error}</span>
                    <button onClick={() => setError(null)} aria-label="Dismiss error">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>
            )}
            
            <div className="chatInput">
                {documents.length > 0 && (
                    <div className="attachmentList">
                        {documents.map((document) => (
                            <div
                                className="attachmentChip"
                                key={document.id}
                                title={`${document.filename} · ${document.chunkCount} indexed chunks`}
                            >
                                <i className={`fa-solid ${document.mimeType === "application/pdf" ? "fa-file-pdf" : "fa-file-lines"}`}></i>
                                <span>{document.filename}</span>
                                <button
                                    onClick={() => void removeDocument(document.id)}
                                    aria-label={`Remove ${document.filename}`}
                                >
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                    hidden
                    onChange={(event) => void handleFileChange(event)}
                />

                <div className="inputBox">
                    <textarea 
                        placeholder="Ask me anything..." 
                        value={prompt}
                        onChange={(event) => setPrompt(event.target.value)}
                        onKeyDown={handleKeyPress}
                        rows={1}
                        disabled={loading}
                    />
                    <div className="inputActions">
                        <button
                            className="attachBtn"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading || loading}
                            title="Attach a PDF or text document"
                            aria-label="Attach a document"
                        >
                            <i className={`fa-solid ${uploading ? "fa-spinner fa-spin" : "fa-paperclip"}`}></i>
                        </button>
                        {charCount > 0 && (
                            <span className="charCount">{charCount}</span>
                        )}
                        <button 
                            id="submit" 
                            onClick={loading ? stopStreaming : () => void getReply()}
                            disabled={!loading && !prompt.trim()}
                            title={loading ? "Stop response" : "Send message"}
                            aria-label={loading ? "Stop response" : "Send message"}
                        >
                            <i className={`fa-solid fa-${loading ? 'stop' : 'paper-plane'}`}></i>
                        </button>
                    </div>
                </div>
                <p className="info">
                    <i className="fa-solid fa-shield-halved"></i>
                    MAI may produce inaccurate information. Verify important details.
                </p>
            </div>
        </div>
    )
}

export default ChatWindow;

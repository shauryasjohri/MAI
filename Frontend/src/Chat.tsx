import "./Chat.css";
import { useEffect, useRef, useState } from "react";
import { useMyContext } from "./MyContext";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import "highlight.js/styles/atom-one-dark.css";

const sanitizeSchema: SanitizeSchema = {
    ...defaultSchema,
    attributes: {
        ...defaultSchema.attributes,
        code: [...(defaultSchema.attributes?.code ?? []), ["className", /^language-/]],
        span: [...(defaultSchema.attributes?.span ?? []), ["className", /^hljs/]],
        pre: [...(defaultSchema.attributes?.pre ?? []), ["className", /^hljs/]]
    }
};

function Chat() {
    const { newChat, prevChats, isStreaming } = useMyContext();
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
    }, [prevChats, isStreaming]);

    const copyToClipboard = (text: string, index: number) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
        });
    };

    const formatTime = (timestamp?: string) => {
        const date = timestamp ? new Date(timestamp) : new Date();
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getWordCount = (text: string) => {
        return text.trim().split(/\s+/).filter(Boolean).length;
    };

    return (
        <div className="chatContainer">
            {newChat && prevChats.length === 0 ? (
                <div className="welcomeScreen">
                    <div className="welcomeContent">
                        <h1>Welcome to MAI</h1>
                        <p className="welcomeSubtitle">Your intelligent AI assistant</p>
                        
                        <div className="suggestionCards">
                            <div className="suggestionCard">
                                <i className="fa-solid fa-code"></i>
                                <h3>Code Assistant</h3>
                                <p>Get help with programming and debugging</p>
                            </div>
                            <div className="suggestionCard">
                                <i className="fa-solid fa-lightbulb"></i>
                                <h3>Creative Ideas</h3>
                                <p>Brainstorm and generate creative content</p>
                            </div>
                            <div className="suggestionCard">
                                <i className="fa-solid fa-book"></i>
                                <h3>Learn Anything</h3>
                                <p>Ask questions and expand your knowledge</p>
                            </div>
                            <div className="suggestionCard">
                                <i className="fa-solid fa-pen"></i>
                                <h3>Write Better</h3>
                                <p>Improve your writing and communication</p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="chats">
                    {prevChats.map((chat, index) => {
                        const isLast = index === prevChats.length - 1;
                        const isWriting = isLast && chat.role === "assistant" && isStreaming;

                        return (
                            <div
                                className={`messageWrapper ${chat.role === "user" ? "userWrapper" : "assistantWrapper"}`}
                                key={`${index}-${chat.timestamp}`}
                            >
                                <div className={chat.role === "user" ? "userDiv" : "gptDiv"}>
                                    <div className="messageHeader">
                                        <span className="roleName">
                                            {chat.role === "user" ? "You" : "MAI"}
                                        </span>
                                        <span className="timestamp">{formatTime(chat.timestamp)}</span>
                                        {isWriting && (
                                            <span className="typingIndicator">
                                                <i className="fa-solid fa-ellipsis"></i>
                                            </span>
                                        )}
                                    </div>

                                    <div className="messageContent">
                                        {chat.role === "user" ? (
                                            <p className="userMessage">{chat.content}</p>
                                        ) : chat.content === "" ? (
                                            <span className="typingIndicator">
                                                <i className="fa-solid fa-ellipsis"></i>
                                            </span>
                                        ) : (
                                            <>
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    rehypePlugins={[rehypeHighlight, [rehypeSanitize, sanitizeSchema]]}
                                                >
                                                    {chat.content}
                                                </ReactMarkdown>
                                                {isWriting && <span className="streamCursor" aria-hidden="true" />}
                                                <div className="messageActions">
                                                    <button
                                                        className="actionBtn"
                                                        onClick={() => copyToClipboard(chat.content, index)}
                                                        title="Copy to clipboard"
                                                        aria-label="Copy message"
                                                    >
                                                        <i className={`fa-solid fa-${copiedIndex === index ? 'check' : 'copy'}`}></i>
                                                        {copiedIndex === index && <span>Copied!</span>}
                                                    </button>
                                                    <span className="wordCount">
                                                        {getWordCount(chat.content)} words
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    <div ref={chatEndRef} />
                </div>
            )}
        </div>
    );
}

export default Chat;

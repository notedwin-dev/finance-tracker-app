import React, { useState, useEffect, useRef } from "react";
import {
  Account,
  Transaction,
  Category,
  ChatSession,
  ChatMessage,
} from "../types";
import {
  streamFinancialAdvice,
  generateChatTitle,
} from "../services/gemini.services";
import {
  SparklesIcon,
  PaperAirplaneIcon,
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  ChatBubbleLeftRightIcon,
  Bars3Icon,
} from "@heroicons/react/24/outline";

interface Props {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  sessions: ChatSession[];
  activeSessionId: string | null;
  onClose: () => void;
  onSaveSession: (session: ChatSession) => void;
  onDeleteSession: (sessionId: string) => void;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  apiKey?: string;
}

const AIInsights: React.FC<Props> = ({
  accounts,
  transactions,
  categories,
  sessions,
  activeSessionId,
  onClose,
  onSaveSession,
  onDeleteSession,
  onSelectSession,
  onNewChat,
  apiKey,
}) => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages, streamingText]);

  const handleAsk = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || loading || !apiKey) return;

    const userQuery = query.trim();
    setQuery("");
    setLoading(true);
    setStreamingText("");

    // 1. Create message objects
    const userMessage: ChatMessage = {
      role: "user",
      content: userQuery,
      timestamp: Date.now(),
    };

    let currentSession: ChatSession;
    if (!activeSession) {
      currentSession = {
        id: crypto.randomUUID(),
        userId: accounts[0]?.userId || "guest",
        title: "New Chat",
        messages: [userMessage],
        updatedAt: Date.now(),
      };
      onSaveSession(currentSession);
      onSelectSession(currentSession.id);
    } else {
      currentSession = {
        ...activeSession,
        messages: [...activeSession.messages, userMessage],
        updatedAt: Date.now(),
      };
      onSaveSession(currentSession);
    }

    try {
      let fullResponse = "";
      const history = currentSession.messages;

      const aiResponsePromise = streamFinancialAdvice(
        apiKey,
        accounts,
        transactions,
        categories,
        history,
        (chunk) => {
          setStreamingText((prev) => prev + chunk);
          fullResponse += chunk;
        },
      );

      const finalResponse = await aiResponsePromise;

      const aiMessage: ChatMessage = {
        role: "model",
        content: finalResponse,
        timestamp: Date.now(),
      };

      const updatedSession = {
        ...currentSession,
        messages: [...currentSession.messages, aiMessage],
        updatedAt: Date.now(),
      };

      // Auto-titling if it's the first exchange
      if (
        currentSession.title === "New Chat" &&
        currentSession.messages.length === 1
      ) {
        const title = await generateChatTitle(apiKey, userQuery, finalResponse);
        updatedSession.title = title;
      }

      onSaveSession(updatedSession);
      setStreamingText("");
    } catch (err) {
      console.error(err);
      const errorMessage: ChatMessage = {
        role: "model",
        content:
          "Sorry, I encountered an error. Please check your API key or try again later.",
        timestamp: Date.now(),
      };
      onSaveSession({
        ...currentSession,
        messages: [...currentSession.messages, errorMessage],
        updatedAt: Date.now(),
      });
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    "How much did I spend this week?",
    "Am I on track for my savings goals?",
    "Analyze my biggest expense category.",
    "Help me create a budget for next month.",
  ];

  return (
    <div className="fixed inset-0 bg-background z-[100] flex animate-fadeIn">
      {/* Sidebar - Desktop */}
      <div
        className={`${
          showSidebar ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 fixed lg:static inset-y-0 left-0 w-72 bg-surface border-r border-gray-800 z-50 transition-transform duration-300 flex flex-col`}
      >
        <div className="p-4 flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-primary" />
            <span className="font-bold text-white uppercase tracking-widest text-xs">
              ZenFinance AI
            </span>
          </div>
          <button
            onClick={() => setShowSidebar(false)}
            className="lg:hidden p-1 text-gray-400 hover:text-white"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4">
          <button
            onClick={() => {
              onNewChat();
              setShowSidebar(false);
            }}
            className="w-full flex items-center justify-center gap-2 bg-primary/10 text-primary hover:bg-primary/20 p-3 rounded-xl transition-all font-bold text-sm"
          >
            <PlusIcon className="w-4 h-4" /> New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {sessions
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((s) => (
              <div
                key={s.id}
                onClick={() => {
                  onSelectSession(s.id);
                  setShowSidebar(false);
                }}
                className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                  activeSessionId === s.id
                    ? "bg-primary/20 text-white"
                    : "text-gray-400 hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <ChatBubbleLeftRightIcon className="w-4 h-4 shrink-0" />
                  <span className="text-sm truncate font-medium">
                    {s.title}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(s.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative h-full overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-gray-800 flex items-center justify-between px-4 sm:px-6 bg-background/50 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSidebar(true)}
              className="lg:hidden p-2 text-gray-400"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-sm font-bold text-white truncate max-w-[150px] sm:max-w-xs">
                {activeSession?.title || "AI Assistant"}
              </h2>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">
                  Gemini 1.5 Flash
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
          {!activeSession && !loading && (
            <div className="h-full flex flex-col items-center justify-center max-w-lg mx-auto text-center space-y-8 animate-slideUp">
              <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center rotate-3">
                <SparklesIcon className="w-10 h-10 text-primary" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white mb-2">
                  How can I help you today?
                </h3>
                <p className="text-gray-400 text-sm px-4">
                  I can analyze your spending, check your budget limits, or help
                  you plan your savings goals.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setQuery(s);
                    }}
                    className="text-left p-4 bg-surface border border-gray-800 rounded-2xl text-xs sm:text-sm text-gray-300 hover:border-primary/50 transition-all hover:bg-primary/5 shadow-sm"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeSession?.messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 sm:p-5 ${
                  m.role === "user"
                    ? "bg-primary text-white rounded-tr-none shadow-lg shadow-primary/10"
                    : "bg-surface border border-gray-800 text-gray-200 rounded-tl-none"
                }`}
              >
                <div className="prose prose-invert prose-sm max-w-none break-words">
                  {m.content.split("\n").map((line, idx) => (
                    <p key={idx} className={idx > 0 ? "mt-2" : ""}>
                      {line}
                    </p>
                  ))}
                </div>
                <p
                  className={`text-[9px] mt-2 font-bold uppercase tracking-widest ${
                    m.role === "user" ? "text-white/50" : "text-gray-600"
                  }`}
                >
                  {new Date(m.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}

          {streamingText && (
            <div className="flex justify-start">
              <div className="max-w-[85%] sm:max-w-[75%] bg-surface border border-gray-800 text-gray-200 rounded-2xl rounded-tl-none p-4 sm:p-5">
                <div className="prose prose-invert prose-sm max-w-none">
                  {streamingText.split("\n").map((line, idx) => (
                    <p key={idx} className={idx > 0 ? "mt-2" : ""}>
                      {line}
                    </p>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <div className="w-1 h-1 bg-primary rounded-full animate-bounce" />
                  <div className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 sm:p-6 bg-gradient-to-t from-background via-background to-transparent shrink-0">
          <form
            onSubmit={handleAsk}
            className="max-w-4xl mx-auto relative group"
          >
            <textarea
              rows={1}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAsk();
                }
              }}
              placeholder={
                apiKey ? "Type your message..." : "Setup API Key in Profile"
              }
              disabled={loading || !apiKey}
              className="w-full bg-surface border border-gray-800 focus:border-primary rounded-2xl py-4 pl-5 pr-14 text-white focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all resize-none max-h-48 custom-scrollbar shadow-2xl"
            />
            <button
              type="submit"
              disabled={loading || !query.trim() || !apiKey}
              className="absolute right-3 bottom-3 p-2.5 bg-primary text-white rounded-xl hover:bg-primary-hover disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </form>
          <p className="text-[10px] text-gray-600 text-center mt-3 font-medium uppercase tracking-widest">
            ZenFinance AI can make mistakes. Always verify important
            calculations.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AIInsights;

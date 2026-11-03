"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  MessageSquare,
  Plus,
  Send,
  Loader2,
  Trash2,
  AlertCircle,
  FileText,
  Award,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { api, Conversation, Message, TopicMetadata } from "@/lib/api";

function ChatComponent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialConvId = searchParams.get("id") || "";

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(initialConvId || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [latestTopic, setLatestTopic] = useState<TopicMetadata | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversation list
  useEffect(() => {
    loadConversations();
  }, []);

  // Load active conversation messages
  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId);
    } else {
      setMessages([]);
    }
  }, [activeConvId]);

  // Auto-send if initialQuery provided
  useEffect(() => {
    if (initialQuery && !activeConvId) {
      handleSend(initialQuery);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  async function loadConversations() {
    try {
      const data = await api.listConversations();
      setConversations(data);
    } catch {
      setConversations([]);
    }
  }

  async function loadMessages(id: string) {
    try {
      const conv = await api.getConversation(id);
      setMessages(conv.messages || []);
      setErrorMsg(null);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || "Failed to load conversation messages.");
    }
  }

  const handleSend = async (overrideText?: string) => {
    const textToSend = (overrideText || input).trim();
    if (!textToSend || loading) return;

    setErrorMsg(null);
    setLoading(true);

    // Optimistically update input state to preserve unsent input on failure (WEB-003)
    const backupInput = textToSend;
    setInput("");

    try {
      const res = await api.sendMessage({
        message: textToSend,
        conversation_id: activeConvId || undefined,
      });

      setActiveConvId(res.conversation_id);
      setMessages((prev) => [...prev, res.user_message, res.assistant_message]);
      if (res.topic_metadata) {
        setLatestTopic(res.topic_metadata);
      }
      loadConversations();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || "Failed to deliver message. Your text has been restored.");
      // WEB-003: Recoverable errors preserve unsent input
      setInput(backupInput);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
    setLatestTopic(null);
    setErrorMsg(null);
    setInput("");
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this conversation?")) return;
    try {
      await api.deleteConversation(id);
      if (activeConvId === id) {
        handleNewChat();
      }
      loadConversations();
    } catch {
      alert("Unable to delete conversation.");
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] md:h-screen w-full overflow-hidden bg-slate-50">
      {/* Sidebar: Conversation List */}
      <aside className="w-72 bg-white border-r border-slate-200 hidden lg:flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="font-bold text-sm text-slate-800">Conversations</span>
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              No conversations yet.
            </div>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => setActiveConvId(c.id)}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs font-medium transition ${
                  activeConvId === c.id
                    ? "bg-indigo-50 text-indigo-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="truncate">{c.title}</span>
                </div>
                <button
                  onClick={(e) => handleDelete(c.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-600 transition"
                  aria-label="Delete conversation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Chat Thread */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 relative">
        {/* Topic Badge Header */}
        {latestTopic && (
          <div className="px-6 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center gap-3 text-xs text-indigo-800">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>
              Detected Topic: <strong>{latestTopic.subject}</strong> → {latestTopic.topic} ({latestTopic.difficulty})
            </span>
          </div>
        )}

        {/* Messages Viewport */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.length === 0 && !loading ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3 text-slate-500">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-slate-700 mb-1">Start a Conversation</h3>
              <p className="text-xs max-w-sm">
                Ask a question about computer science, math, physics, biology, or paste an excerpt to explain.
              </p>
            </div>
          ) : (
            messages.map((m, idx) => (
              <div
                key={m.id || idx}
                className={`flex flex-col ${
                  m.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-2xl px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-none shadow-sm"
                      : "bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-sm whitespace-pre-wrap"
                  }`}
                >
                  {m.content}
                </div>

                {/* Inline follow-up actions for assistant replies */}
                {m.role === "assistant" && activeConvId && (
                  <div className="flex items-center gap-2 mt-1.5 text-xs">
                    <Link
                      href={`/summaries?conv_id=${activeConvId}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-200/60 hover:bg-slate-200 text-slate-700 transition"
                    >
                      <FileText className="w-3 h-3 text-indigo-600" />
                      <span>Summarize</span>
                    </Link>
                    <Link
                      href={`/quizzes?conv_id=${activeConvId}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-200/60 hover:bg-slate-200 text-slate-700 transition"
                    >
                      <Award className="w-3 h-3 text-purple-600" />
                      <span>Generate Quiz</span>
                    </Link>
                  </div>
                )}
              </div>
            ))
          )}

          {/* Loading Indicator (WEB-003) */}
          {loading && (
            <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span>Thinking and formulating response...</span>
            </div>
          )}

          {/* Error Notification Banner (WEB-010) */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 max-w-4xl mx-auto"
          >
            <label htmlFor="chat-input" className="sr-only">
              Type your question
            </label>
            <input
              id="chat-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything or request a clarification..."
              className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-8 text-slate-400 text-sm">
          Loading Chat...
        </div>
      }
    >
      <ChatComponent />
    </Suspense>
  );
}


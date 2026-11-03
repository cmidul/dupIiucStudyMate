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
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { api, Conversation, Message, TopicMetadata } from "@/lib/api";
import { FormattedTextWithMath } from "@/components/MathRenderer";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function loadConversations() {
    try {
      const convs = await api.listConversations();
      setConversations(convs);
    } catch {
      setConversations([]);
    }
  }

  async function loadMessages(convId: string) {
    try {
      const conv = await api.getConversation(convId);
      setMessages(conv.messages || []);
    } catch {
      setMessages([]);
    }
  }

  const handleSend = async (overrideText?: string) => {
    const textToSend = overrideText || input;
    if (!textToSend.trim() || loading) return;

    setErrorMsg(null);
    const backupInput = textToSend;
    setInput("");
    setLoading(true);

    try {
      const res = await api.sendMessage({
        message: textToSend,
        conversation_id: activeConvId || undefined,
      });

      if (!activeConvId) {
        setActiveConvId(res.conversation_id);
      }
      setMessages((prev) => [...prev, res.user_message, res.assistant_message]);
      if (res.topic_metadata) {
        setLatestTopic(res.topic_metadata);
      }
      loadConversations();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || "Failed to deliver message. Your text has been restored.");
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
    if (!confirm("Are you sure you want to permanently delete this academic thread?")) return;
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
    <div className="flex h-[calc(100vh-4rem)] md:h-screen w-full overflow-hidden bg-slate-50 dark:bg-midnight-950">
      {/* Sidebar: Conversation List */}
      <aside className="w-72 bg-white dark:bg-midnight-900 border-r border-slate-200 dark:border-slate-800 hidden lg:flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-wider text-slate-500 font-semibold">
            Inquiry Logs
          </span>
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 bg-slate-100 dark:bg-midnight-800 text-slate-800 dark:text-slate-200 hover:text-scholar-emerald dark:hover:text-scholar-emerald rounded-lg transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Session</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              No historical sessions recorded.
            </div>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => setActiveConvId(c.id)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer text-xs font-medium transition ${
                  activeConvId === c.id
                    ? "bg-slate-100 dark:bg-midnight-800 text-slate-900 dark:text-scholar-emerald font-semibold border-l-2 border-scholar-emerald"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-midnight-800/50"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="truncate">{c.title}</span>
                </div>
                <button
                  onClick={(e) => handleDelete(c.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition"
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
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-midnight-950 relative">
        {/* Topic Badge Header */}
        {latestTopic && (
          <div className="px-6 py-2.5 bg-white dark:bg-midnight-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 text-xs text-slate-700 dark:text-slate-300">
            <span className="text-[10px] font-mono text-scholar-emerald font-semibold uppercase tracking-wider">
              Topic Analysis:
            </span>
            <span className="font-medium">
              {latestTopic.subject} → {latestTopic.topic} ({latestTopic.difficulty})
            </span>
          </div>
        )}

        {/* Messages Viewport */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-5">
          {messages.length === 0 && !loading ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-midnight-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mb-3 text-scholar-emerald">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="font-serif font-semibold text-slate-800 dark:text-slate-200 text-base mb-1">
                Academic Dialogue Workspace
              </h3>
              <p className="text-xs max-w-sm text-slate-500 dark:text-slate-400">
                Inquire about theoretical principles, mathematical derivations, or algorithmic edge cases.
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
                  className={`max-w-2xl px-5 py-3.5 rounded-2xl text-xs md:text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 rounded-br-none shadow-sm whitespace-pre-wrap"
                      : "bg-white dark:bg-midnight-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-bl-none shadow-sm whitespace-pre-wrap font-sans"
                  }`}
                >
                  <FormattedTextWithMath text={m.content} />
                </div>

                {/* Inline follow-up actions for assistant replies */}
                {m.role === "assistant" && activeConvId && (
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <Link
                      href={`/summaries?conv_id=${activeConvId}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-midnight-800 hover:bg-slate-200 dark:hover:bg-midnight-700 text-slate-600 dark:text-slate-300 transition text-[11px] font-mono"
                    >
                      <FileText className="w-3 h-3 text-scholar-emerald" />
                      <span>Synthesize Summary</span>
                    </Link>
                    <Link
                      href={`/quizzes?conv_id=${activeConvId}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-midnight-800 hover:bg-slate-200 dark:hover:bg-midnight-700 text-slate-600 dark:text-slate-300 transition text-[11px] font-mono"
                    >
                      <Award className="w-3 h-3 text-scholar-emerald" />
                      <span>Test Knowledge</span>
                    </Link>
                  </div>
                )}
              </div>
            ))
          )}

          {/* Loading Indicator */}
          {loading && (
            <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
              <Loader2 className="w-4 h-4 animate-spin text-scholar-emerald" />
              <span>Analyzing query context and formulating response...</span>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-white dark:bg-midnight-900 border-t border-slate-200 dark:border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 max-w-4xl mx-auto"
          >
            <label htmlFor="chat-input" className="sr-only">
              Type your academic inquiry
            </label>
            <input
              id="chat-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a conceptual question, request a proof, or clarify details..."
              className="flex-1 px-4 py-3 text-xs md:text-sm bg-slate-50 dark:bg-midnight-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:bg-white dark:focus:bg-midnight-900 focus:outline-none focus:ring-1 focus:ring-scholar-emerald text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-3 bg-slate-900 dark:bg-scholar-emerald text-white dark:text-slate-950 rounded-xl hover:bg-slate-800 dark:hover:bg-emerald-600 disabled:opacity-40 transition shadow-sm"
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
        <div className="flex-1 flex items-center justify-center p-8 text-slate-400 text-xs font-mono">
          Loading Academic Dialogue...
        </div>
      }
    >
      <ChatComponent />
    </Suspense>
  );
}

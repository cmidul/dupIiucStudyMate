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

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId);
    } else {
      setMessages([]);
    }
  }, [activeConvId]);

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
    if (!confirm("Are you sure you want to delete this chat thread?")) return;
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
    <div className="flex flex-col lg:flex-row gap-6 h-[78vh] min-h-[560px]">
      {/* Conversations Drawer / Sidebar */}
      <aside className="w-full lg:w-64 bg-[#1C1F26] border border-[#2E333D] rounded-2xl flex flex-col flex-shrink-0 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#262A33] flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-wider text-[#A0A6B4] font-semibold">
            History
          </span>
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 bg-[#3B6CFF] hover:bg-[#5A82FF] active:bg-[#2A55D9] text-white rounded-xl shadow-[0_0_10px_rgba(59,108,255,0.3)] transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#6B7280]">
              No conversations yet.
            </div>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => setActiveConvId(c.id)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-xs font-medium transition ${
                  activeConvId === c.id
                    ? "bg-[#242832] text-white font-semibold border border-[#3B6CFF]/50"
                    : "text-[#A0A6B4] hover:bg-[#14161A] hover:text-[#E8EAF0]"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare className="w-3.5 h-3.5 text-[#3B6CFF] flex-shrink-0" />
                  <span className="truncate">{c.title}</span>
                </div>
                <button
                  onClick={(e) => handleDelete(c.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-[#6B7280] hover:text-[#FF5C6C] transition"
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
      <div className="flex-1 min-w-0 bg-[#1C1F26] border border-[#2E333D] rounded-2xl flex flex-col h-full overflow-hidden shadow-xl">
        {/* Topic Header */}
        {latestTopic && (
          <div className="px-6 py-2.5 bg-[#14161A] border-b border-[#262A33] flex items-center gap-3 text-xs text-[#E8EAF0]">
            <span className="text-[10px] font-mono text-[#3B6CFF] font-semibold uppercase tracking-wider">
              Topic:
            </span>
            <span className="font-medium">
              {latestTopic.subject} → {latestTopic.topic} ({latestTopic.difficulty})
            </span>
          </div>
        )}

        {/* Messages Viewport */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.length === 0 && !loading ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#A0A6B4]">
              <div className="w-12 h-12 rounded-2xl bg-[#14161A] border border-[#2E333D] flex items-center justify-center mb-3 text-[#3B6CFF]">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-[#E8EAF0] text-base mb-1">
                What concept would you like to explore?
              </h3>
              <p className="text-xs max-w-sm text-[#A0A6B4]">
                Ask for an intuitive explanation, step-by-step proof, or real-world example.
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
                  className={`max-w-full sm:max-w-xl md:max-w-2xl break-words px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-[#3B6CFF] text-white rounded-tr-none shadow-[0_0_15px_rgba(59,108,255,0.25)] whitespace-pre-wrap font-medium"
                      : "bg-[#14161A] text-[#E8EAF0] border border-[#2E333D] rounded-tl-none whitespace-pre-wrap"
                  }`}
                >
                  <FormattedTextWithMath text={m.content} />
                </div>

                {/* Inline follow-up actions for assistant replies */}
                {m.role === "assistant" && activeConvId && (
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <Link
                      href={`/summaries?conv_id=${activeConvId}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#14161A] hover:bg-[#242832] border border-[#2E333D] text-[#A0A6B4] hover:text-[#E8EAF0] transition text-[11px] font-mono"
                    >
                      <FileText className="w-3 h-3 text-[#3B6CFF]" />
                      <span>Create Notes</span>
                    </Link>
                    <Link
                      href={`/quizzes?conv_id=${activeConvId}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#14161A] hover:bg-[#242832] border border-[#2E333D] text-[#A0A6B4] hover:text-[#E8EAF0] transition text-[11px] font-mono"
                    >
                      <Award className="w-3 h-3 text-[#3B6CFF]" />
                      <span>Generate Quiz</span>
                    </Link>
                  </div>
                )}
              </div>
            ))
          )}

          {loading && (
            <div className="flex items-center gap-2 text-[#A0A6B4] text-xs py-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#3B6CFF]" />
              <span>Analyzing context and preparing response...</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-[#FF5C6C]/10 border border-[#FF5C6C]/30 text-[#FF5C6C] rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-[#14161A] border-t border-[#262A33]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 max-w-4xl mx-auto"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question or request a derivation..."
              className="flex-1 px-4 py-2.5 text-xs sm:text-sm bg-[#1C1F26] border border-[#2E333D] rounded-xl focus:border-[#3B6CFF] outline-none text-[#E8EAF0] placeholder:text-[#6B7280]"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2.5 sm:p-3 bg-[#3B6CFF] hover:bg-[#5A82FF] active:bg-[#2A55D9] text-white rounded-xl shadow-[0_0_12px_rgba(59,108,255,0.3)] disabled:opacity-40 transition flex-shrink-0"
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
        <div className="flex-1 flex items-center justify-center p-8 text-[#A0A6B4] text-xs font-mono">
          Loading AI Tutor Chat...
        </div>
      }
    >
      <ChatComponent />
    </Suspense>
  );
}

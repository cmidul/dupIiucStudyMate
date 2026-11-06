"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  History as HistoryIcon,
  MessageSquare,
  Search,
  Trash2,
  Calendar,
  ExternalLink,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { api, Conversation } from "@/lib/api";

type TimeBucket = "Today" | "Yesterday" | "This Week" | "Earlier";

export default function HistoryPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const convs = await api.listConversations();
      setConversations(convs);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to permanently delete this study session?")) return;
    setDeletingId(id);
    try {
      await api.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert("Failed to delete record.");
    } finally {
      setDeletingId(null);
    }
  };

  const groupedConversations = useMemo(() => {
    const filtered = conversations.filter((c) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.title.toLowerCase().includes(q) ||
        (c.messages && c.messages.some((m) => m.content.toLowerCase().includes(q)))
      );
    });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const oneWeekAgo = today - 7 * 86400000;

    const groups: Record<TimeBucket, Conversation[]> = {
      Today: [],
      Yesterday: [],
      "This Week": [],
      Earlier: [],
    };

    filtered.forEach((conv) => {
      const itemTime = new Date(conv.created_at).getTime();
      if (itemTime >= today) {
        groups.Today.push(conv);
      } else if (itemTime >= yesterday) {
        groups.Yesterday.push(conv);
      } else if (itemTime >= oneWeekAgo) {
        groups["This Week"].push(conv);
      } else {
        groups.Earlier.push(conv);
      }
    });

    return groups;
  }, [conversations, searchQuery]);

  const totalFilteredCount =
    groupedConversations.Today.length +
    groupedConversations.Yesterday.length +
    groupedConversations["This Week"].length +
    groupedConversations.Earlier.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#2E333D] pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#E8EAF0] tracking-tight">
            History & Activity Archive
          </h1>
          <p className="text-xs sm:text-sm text-[#A0A6B4] mt-0.5">
            Access previous study queries, chats, and solution threads across web and Telegram.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search past queries..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#1C1F26] border border-[#2E333D] rounded-xl text-[#E8EAF0] placeholder:text-[#6B7280] focus:border-[#3B6CFF] outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-[#A0A6B4] text-xs flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#3B6CFF]" />
          <span>Loading historical study sessions...</span>
        </div>
      ) : conversations.length === 0 ? (
        <div className="py-16 text-center bg-[#1C1F26] border border-dashed border-[#2E333D] rounded-2xl p-8 space-y-3 shadow-xl">
          <HistoryIcon className="w-10 h-10 text-[#6B7280] mx-auto mb-2" />
          <h3 className="font-semibold text-[#E8EAF0] text-base">
            No Historical Records Found
          </h3>
          <p className="text-xs text-[#A0A6B4] max-w-sm mx-auto">
            Questions solved on the web or through connected Telegram accounts will appear here automatically.
          </p>
          <div className="pt-2">
            <Link
              href="/solve"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#3B6CFF] hover:bg-[#5A82FF] active:bg-[#2A55D9] text-white rounded-xl text-xs font-semibold transition shadow-[0_0_12px_rgba(59,108,255,0.3)]"
            >
              <span>Solve a Question</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : totalFilteredCount === 0 ? (
        <div className="py-12 text-center text-[#A0A6B4] text-xs">
          No records match your query &quot;{searchQuery}&quot;.
        </div>
      ) : (
        <div className="space-y-8">
          {(["Today", "Yesterday", "This Week", "Earlier"] as TimeBucket[]).map((bucket) => {
            const items = groupedConversations[bucket];
            if (items.length === 0) return null;

            return (
              <div key={bucket} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#3B6CFF]">
                    {bucket}
                  </span>
                  <div className="flex-1 h-px bg-[#262A33]" />
                  <span className="text-[10px] font-mono text-[#6B7280]">
                    {items.length} {items.length === 1 ? "entry" : "entries"}
                  </span>
                </div>

                <div className="bg-[#1C1F26] border border-[#2E333D] rounded-2xl divide-y divide-[#262A33] shadow-xl overflow-hidden">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 flex items-center justify-between hover:bg-[#242832]/60 transition group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 pr-4">
                        <div className="w-8 h-8 rounded-lg bg-[#14161A] border border-[#2E333D] text-[#3B6CFF] flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="w-4 h-4" />
                        </div>

                        <div className="min-w-0">
                          <Link
                            href={`/chat?id=${item.id}`}
                            className="text-xs sm:text-sm font-medium text-[#E8EAF0] hover:text-[#3B6CFF] transition flex items-center gap-1.5 truncate"
                          >
                            <span className="truncate">{item.title}</span>
                            <ExternalLink className="w-3 h-3 text-[#6B7280] flex-shrink-0 opacity-0 group-hover:opacity-100 transition" />
                          </Link>
                          <div className="flex items-center gap-2 text-[11px] font-mono text-[#6B7280] mt-0.5">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {new Date(item.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <span>•</span>
                            <span>{new Date(item.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/chat?id=${item.id}`}
                          className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono text-[#A0A6B4] hover:text-[#E8EAF0] hover:bg-[#14161A] transition"
                        >
                          <span>Review</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>

                        <button
                          type="button"
                          onClick={(e) => handleDelete(item.id, e)}
                          disabled={deletingId === item.id}
                          title="Delete conversation"
                          className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#FF5C6C] hover:bg-[#FF5C6C]/10 transition"
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-[#FF5C6C]" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

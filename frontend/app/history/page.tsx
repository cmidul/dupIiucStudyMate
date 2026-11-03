"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  History as HistoryIcon,
  MessageSquare,
  FileText,
  Search,
  Trash2,
  Calendar,
  ExternalLink,
  Loader2,
  BookOpen,
  ArrowRight,
  Filter,
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
    if (!confirm("Are you sure you want to permanently delete this academic session?")) return;
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

  // Chronological grouping helper
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
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-scholar-emerald font-semibold">
            Archive & Audit
          </span>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 dark:text-slate-100 mt-1">
            Learning Archive
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review past inquiry records, question derivations, and synchronized Telegram exchanges.
          </p>
        </div>

        {/* Live Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search queries and topics..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-midnight-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-scholar-emerald"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-scholar-emerald" />
          <span>Retrieving archived learning sessions...</span>
        </div>
      ) : conversations.length === 0 ? (
        /* Empty State */
        <div className="py-16 text-center bg-white dark:bg-midnight-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8">
          <HistoryIcon className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="font-serif font-semibold text-slate-800 dark:text-slate-200 text-base mb-1">
            No Historical Records Found
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-5">
            Past questions solved on the web or through connected Telegram accounts will be cataloged here automatically.
          </p>
          <Link
            href="/solve"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-scholar-emerald hover:bg-slate-800 dark:hover:bg-emerald-600 text-white dark:text-slate-950 rounded-xl text-xs font-semibold transition"
          >
            <span>Solve a Question</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : totalFilteredCount === 0 ? (
        <div className="py-12 text-center text-slate-400 text-xs">
          No records match your query &quot;{searchQuery}&quot;.
        </div>
      ) : (
        /* Chronological Sections */
        <div className="space-y-8">
          {(["Today", "Yesterday", "This Week", "Earlier"] as TimeBucket[]).map((bucket) => {
            const items = groupedConversations[bucket];
            if (items.length === 0) return null;

            return (
              <div key={bucket} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {bucket}
                  </span>
                  <div className="flex-1 h-px bg-slate-100 dark:bg-midnight-800" />
                  <span className="text-[10px] font-mono text-slate-400">
                    {items.length} {items.length === 1 ? "entry" : "entries"}
                  </span>
                </div>

                <div className="bg-white dark:bg-midnight-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/60 shadow-sm overflow-hidden">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-midnight-800/40 transition group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 pr-4">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-midnight-800 text-slate-600 dark:text-slate-400 flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="w-4 h-4 text-scholar-emerald" />
                        </div>

                        <div className="min-w-0">
                          <Link
                            href={`/chat?id=${item.id}`}
                            className="text-xs md:text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-scholar-emerald dark:hover:text-scholar-emerald transition flex items-center gap-1.5 truncate"
                          >
                            <span className="truncate">{item.title}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition" />
                          </Link>
                          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            <span>•</span>
                            <span>{new Date(item.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/chat?id=${item.id}`}
                          className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-midnight-800 transition"
                        >
                          <span>Review</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>

                        <button
                          type="button"
                          onClick={(e) => handleDelete(item.id, e)}
                          disabled={deletingId === item.id}
                          title="Delete archived conversation"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition"
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-red-500" />
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

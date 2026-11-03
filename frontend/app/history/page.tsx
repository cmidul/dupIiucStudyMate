"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  History as HistoryIcon,
  MessageSquare,
  FileText,
  Award,
  Trash2,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { api, Conversation } from "@/lib/api";

export default function HistoryPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleDelete = async (id: string) => {
    // WEB-008: Confirmation before destructive deletion
    if (!confirm("Are you sure you want to permanently delete this item?")) return;
    try {
      await api.deleteConversation(id);
      loadHistory();
    } catch {
      alert("Failed to delete record.");
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 w-full">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <HistoryIcon className="w-6 h-6 text-indigo-600" />
            <span>Learning History</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review your past study sessions, questions, and generated resources.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          Loading learning history...
        </div>
      ) : conversations.length === 0 ? (
        // WEB-010: Empty state
        <div className="py-12 text-center bg-white border border-dashed border-slate-200 rounded-2xl p-8">
          <HistoryIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-700 text-base mb-1">No History Recorded</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            Items from your website conversations and linked Telegram interactions will appear here automatically.
          </p>
          <Link
            href="/chat"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition"
          >
            Start Learning Now
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-sm overflow-hidden">
          {conversations.map((item) => (
            <div
              key={item.id}
              className="p-4 flex items-center justify-between hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <Link
                    href={`/chat?id=${item.id}`}
                    className="text-sm font-semibold text-slate-800 hover:text-indigo-600 transition flex items-center gap-1.5"
                  >
                    <span>{item.title}</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </Link>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDelete(item.id)}
                className="p-2 text-slate-400 hover:text-red-600 rounded-lg transition"
                aria-label="Delete history item"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


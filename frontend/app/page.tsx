"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  UploadCloud,
  FileText,
  Award,
  Calculator,
  ArrowRight,
  Sparkles,
  Clock,
} from "lucide-react";
import { api, Conversation } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const convs = await api.listConversations();
        setConversations(convs);
      } catch {
        // Unauthenticated or network error handles gracefully
        setConversations([]);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleQuickAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    router.push(`/chat?q=${encodeURIComponent(prompt.trim())}`);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 w-full">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 rounded-2xl p-8 text-white shadow-sm">
        <div className="flex items-center gap-2 text-indigo-200 text-sm font-semibold tracking-wide uppercase mb-2">
          <Sparkles className="w-4 h-4" />
          <span>Multimodal Learning Copilot</span>
        </div>
        <h1 className="text-3xl font-extrabold mb-3">
          Welcome to your Study Workspace
        </h1>
        <p className="text-indigo-100 max-w-2xl text-base mb-6 leading-relaxed">
          Ask questions, upload textbook slides or notes, generate quizzes, and solve math and logic problems with step-by-step verified reasoning.
        </p>

        {/* Quick Question Bar */}
        <form onSubmit={handleQuickAsk} className="flex gap-2 max-w-2xl">
          <label htmlFor="quick-question" className="sr-only">
            What do you want to learn today?
          </label>
          <input
            id="quick-question"
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What would you like to learn today? (e.g., Explain Binary Search Trees)"
            className="flex-1 px-4 py-3 rounded-xl text-slate-900 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-white/40 text-sm"
          />
          <button
            type="submit"
            className="px-5 py-3 bg-indigo-900/60 hover:bg-indigo-900/80 font-semibold text-white rounded-xl text-sm transition flex items-center gap-1.5 shadow-sm border border-white/20"
          >
            <span>Ask</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Quick Actions Grid */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/chat"
            className="p-5 bg-white rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-sm transition group"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 group-hover:scale-105 transition">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-800 text-base mb-1">AI Chat</h3>
            <p className="text-xs text-slate-500">Ask general or follow-up academic questions.</p>
          </Link>

          <Link
            href="/upload"
            className="p-5 bg-white rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-sm transition group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-105 transition">
              <UploadCloud className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-800 text-base mb-1">Upload Notes</h3>
            <p className="text-xs text-slate-500">Extract diagrams, text, and formulas from slides.</p>
          </Link>

          <Link
            href="/quizzes"
            className="p-5 bg-white rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-sm transition group"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-3 group-hover:scale-105 transition">
              <Award className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-800 text-base mb-1">Practice Quiz</h3>
            <p className="text-xs text-slate-500">Generate multiple-choice quizzes with explanations.</p>
          </Link>

          <Link
            href="/solve"
            className="p-5 bg-white rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-sm transition group"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-105 transition">
              <Calculator className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-800 text-base mb-1">Math & Logic</h3>
            <p className="text-xs text-slate-500">Safe SymPy verification and truth-table reasoning.</p>
          </Link>
        </div>
      </div>

      {/* Recent Activity Section (WEB-002) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-400" />
            <span>Recent Conversations</span>
          </h2>
          <Link href="/history" className="text-sm font-medium text-indigo-600 hover:underline">
            View All History →
          </Link>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-400 text-sm">Loading activity...</div>
        ) : conversations.length === 0 ? (
          <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="text-slate-500 text-sm mb-2">No recent learning activity yet.</p>
            <Link
              href="/chat"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline"
            >
              Start your first conversation →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {conversations.slice(0, 5).map((conv) => (
              <Link
                key={conv.id}
                href={`/chat?id=${conv.id}`}
                className="py-3 px-2 flex items-center justify-between hover:bg-slate-50 rounded-lg transition"
              >
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">{conv.title}</h4>
                  <p className="text-xs text-slate-400">
                    {new Date(conv.created_at).toLocaleDateString()}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


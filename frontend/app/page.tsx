"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calculator,
  Award,
  UploadCloud,
  FileText,
  MessageSquare,
  ArrowRight,
  Clock,
  ExternalLink,
  Search,
} from "lucide-react";
import { api, Conversation } from "@/lib/api";

interface ToolItem {
  href: string;
  title: string;
  description: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TOOLS: ToolItem[] = [
  {
    href: "/solve",
    title: "Solve Questions",
    description: "Get a direct answer and worked steps from a written question or a photo.",
    badge: "Start here",
    icon: Calculator,
  },
  {
    href: "/quizzes",
    title: "Practice a quiz",
    description: "Test yourself in practice mode or take a timed quiz.",
    badge: "Practice",
    icon: Award,
  },
  {
    href: "/upload",
    title: "Read an image",
    description: "Extract text and equations from a photo, scan, or lecture slide.",
    badge: "Images",
    icon: UploadCloud,
  },
  {
    href: "/summaries",
    title: "Make study notes",
    description: "Turn a passage or lecture into notes you can review later.",
    badge: "Review",
    icon: FileText,
  },
  {
    href: "/chat",
    title: "Chat with the tutor",
    description: "Explore a topic, ask for an example, or work through a follow-up.",
    badge: "Chat",
    icon: MessageSquare,
  },
];

export default function WorkspaceHomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [recentActivity, setRecentActivity] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecent() {
      try {
        const convs = await api.listConversations();
        setRecentActivity(convs.slice(0, 5));
      } catch {
        setRecentActivity([]);
      } finally {
        setLoading(false);
      }
    }
    fetchRecent();
  }, []);

  const handleQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/solve?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-10 w-full">
      {/* 1. Compact Page Heading */}
      <div className="page-heading answer-panel p-5 sm:p-9 space-y-3">
        <div className="text-sm font-semibold text-scholar-emerald">StudyMate workspace</div>
        <h1 className="font-serif text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          What are you studying today?
        </h1>
        <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
          Start with a question, or choose a tool to practice and review.
        </p>

        {/* Minimal Query / Action Bar */}
        <form onSubmit={handleQuerySubmit} className="mt-4 flex flex-wrap gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Your study question"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter a question or equation"
              className="w-full min-h-11 pl-9 pr-3 py-2 bg-white dark:bg-midnight-850 border border-slate-200 dark:border-midnight-700 rounded-lg text-slate-900 dark:text-slate-200 placeholder:text-slate-500"
            />
          </div>
          <button
            type="submit"
            className="min-h-11 px-4 py-2 bg-scholar-emerald text-sm font-semibold text-white rounded-lg transition flex items-center gap-2 flex-shrink-0"
          >
            <span>Solve</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* 2. Available Learning Tools */}
      <section aria-labelledby="tools-heading">
        <div className="flex items-center justify-between mb-3">
          <h2 id="tools-heading" className="text-lg font-semibold">
            Study tools
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className="workspace-panel p-4 flex items-start justify-between hover:border-teal-600 transition group"
              >
                <div className="flex items-start gap-3.5 pr-4">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-midnight-800 border border-slate-200 dark:border-midnight-700 flex items-center justify-center flex-shrink-0 text-slate-500 dark:text-slate-300 group-hover:text-scholar-emerald group-hover:border-midnight-600 transition mt-0.5">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-scholar-emerald transition font-serif">
                        {tool.title}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-200 dark:border-midnight-700 bg-slate-50 dark:bg-midnight-800 text-slate-500 dark:text-slate-400">
                        {tool.badge}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                      {tool.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center pt-1 flex-shrink-0">
                  <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-scholar-emerald group-hover:translate-x-0.5 transition" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 4. Recent Activity */}
      <section aria-labelledby="activity-heading">
        <div className="flex items-center justify-between mb-3">
          <h2 id="activity-heading" className="text-lg font-semibold">
            Recent activity
          </h2>
          <Link href="/history" className="text-xs text-scholar-emerald hover:text-emerald-600 dark:hover:text-emerald-300 font-mono flex items-center gap-1">
            <span>View all history</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center border border-slate-200 dark:border-midnight-700 rounded-xl bg-white dark:bg-midnight-850 text-xs font-mono text-slate-400 dark:text-slate-500">
            Loading recent records...
          </div>
        ) : recentActivity.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-200 dark:border-midnight-700 rounded-xl bg-slate-50 dark:bg-midnight-850 text-slate-400 space-y-2">
            <Clock className="w-5 h-5 text-slate-400 dark:text-slate-500 mx-auto" />
            <div className="text-xs font-serif font-semibold text-slate-600 dark:text-slate-300">No Past Sessions Yet</div>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
              Problems, summaries, and chat threads created on the web or through your linked Telegram bot will automatically populate here.
            </p>
          </div>
        ) : (
          <div className="border border-slate-200 dark:border-midnight-700 rounded-xl divide-y divide-slate-100 dark:divide-midnight-700 bg-white dark:bg-midnight-850 overflow-hidden shadow-sm">
            {recentActivity.map((conv) => (
              <div key={conv.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-midnight-800 transition">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded bg-slate-100 dark:bg-midnight-800 border border-slate-200 dark:border-midnight-700 flex items-center justify-center text-slate-400 dark:text-slate-500">
                    <Clock className="w-3 h-3" />
                  </div>
                  <div>
                    <Link
                      href={`/chat?id=${conv.id}`}
                      className="text-xs font-medium text-slate-800 dark:text-slate-200 hover:text-scholar-emerald dark:hover:text-scholar-emerald transition"
                    >
                      {conv.title}
                    </Link>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 block">
                      {new Date(conv.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/chat?id=${conv.id}`}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-midnight-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                  aria-label="Open conversation"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

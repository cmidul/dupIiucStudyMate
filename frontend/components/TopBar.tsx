"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Palette,
  Timer,
  User as UserIcon,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { useFocus } from "./FocusContext";
import { api, User } from "@/lib/api";

const ROUTE_TITLES: Record<string, string> = {
  "/": "Focus Workspace",
  "/solve": "Solve Questions",
  "/quizzes": "Quizzes & Practice",
  "/chat": "AI Tutor Chat",
  "/summaries": "Study Notes",
  "/upload": "Image Reader",
  "/history": "History & Archive",
  "/settings": "Settings & Account",
  "/login": "Sign In",
  "/register": "Register",
};

export default function TopBar() {
  const pathname = usePathname();
  const {
    isControlsVisible,
    prefersReducedMotion,
    setIsScenePickerOpen,
    isTimerRunning,
    completedSessions,
  } = useFocus();

  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    api.getMe().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, [pathname]);

  const currentTitle = ROUTE_TITLES[pathname] || "StudyMate";

  // Transition classes:
  const transitionClass = prefersReducedMotion
    ? "transition-opacity duration-200"
    : "transition-all duration-300 ease-in-out";

  const visibilityClass = isControlsVisible
    ? "opacity-100 translate-y-0"
    : "opacity-0 -translate-y-4 pointer-events-none";

  return (
    <header
      className={`fixed top-0 left-0 right-0 h-14 z-30 px-4 sm:px-8 flex items-center justify-between border-b border-[#2E333D]/60 bg-[#14161A]/80 backdrop-blur-md ${transitionClass} ${visibilityClass}`}
    >
      {/* Left: Brand & Breadcrumb */}
      <div className="flex items-center gap-2.5">
        <Link
          href="/"
          className="flex items-center gap-2 group text-[#E8EAF0] hover:text-white transition"
          aria-label="StudyMate Home"
        >
          <div className="w-7 h-7 rounded-lg bg-[#3B6CFF]/15 border border-[#3B6CFF]/40 text-[#3B6CFF] flex items-center justify-center font-bold text-xs shadow-[0_0_10px_rgba(59,108,255,0.25)]">
            SM
          </div>
          <span className="font-semibold text-sm tracking-tight hidden sm:inline">
            StudyMate
          </span>
        </Link>

        <ChevronRight className="w-3.5 h-3.5 text-[#6B7280]" />

        <h1 className="text-xs sm:text-sm font-medium text-[#A0A6B4] truncate max-w-[200px] sm:max-w-none">
          {currentTitle}
        </h1>

        {isTimerRunning && (
          <div className="hidden md:flex items-center gap-1.5 ml-2 px-2.5 py-0.5 rounded-full bg-[#3B6CFF]/10 border border-[#3B6CFF]/30 text-[11px] font-medium text-[#3B6CFF]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3B6CFF] animate-pulse" />
            <span>Focus Active</span>
          </div>
        )}
      </div>

      {/* Right: Scene Button & User Avatar */}
      <div className="flex items-center gap-2">
        {completedSessions > 0 && (
          <div
            title={`${completedSessions} completed focus sessions today`}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1C1F26] border border-[#2E333D] text-[11px] font-mono text-[#A0A6B4]"
          >
            <Timer className="w-3 h-3 text-[#3B6CFF]" />
            <span>{completedSessions}</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsScenePickerOpen(true)}
          aria-label="Change background scene"
          title="Change background scene"
          className="p-2 rounded-xl text-[#A0A6B4] hover:text-[#E8EAF0] hover:bg-[#1C1F26] border border-transparent hover:border-[#2E333D] transition flex items-center gap-1.5 text-xs font-medium"
        >
          <Palette className="w-4 h-4 text-[#3B6CFF]" />
          <span className="hidden sm:inline">Scenes</span>
        </button>

        {currentUser ? (
          <Link
            href="/settings"
            aria-label={`Profile settings for ${currentUser.name || currentUser.email}`}
            title={`Signed in as ${currentUser.name || currentUser.email}`}
            className="flex items-center gap-2 p-1 pl-2 pr-2.5 rounded-xl bg-[#1C1F26] border border-[#2E333D] hover:border-[#3B6CFF]/50 transition group"
          >
            <div className="w-6 h-6 rounded-full bg-[#3B6CFF]/20 border border-[#3B6CFF]/40 text-[#3B6CFF] font-bold text-xs flex items-center justify-center">
              {(currentUser.name?.[0] || currentUser.email[0]).toUpperCase()}
            </div>
            <span className="text-xs font-medium text-[#E8EAF0] group-hover:text-white max-w-[100px] truncate hidden sm:inline">
              {currentUser.name || currentUser.email.split("@")[0]}
            </span>
          </Link>
        ) : (
          <Link
            href="/login"
            aria-label="Sign in"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1C1F26] hover:bg-[#242832] border border-[#2E333D] hover:border-[#3B6CFF]/40 text-xs font-medium text-[#E8EAF0] transition"
          >
            <UserIcon className="w-3.5 h-3.5 text-[#3B6CFF]" />
            <span>Sign In</span>
          </Link>
        )}
      </div>
    </header>
  );
}

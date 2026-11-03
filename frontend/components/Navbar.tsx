"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Calculator,
  Award,
  UploadCloud,
  History as HistoryIcon,
  Bookmark,
  Settings,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  MessageSquare,
  LogIn,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { api, User } from "@/lib/api";

interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Home", description: "Academic workspace", icon: Compass },
  { href: "/solve", label: "Solve Questions", description: "Math, logic & passage solver", icon: Calculator },
  { href: "/quizzes", label: "Quiz Generator", description: "Exam & practice assessments", icon: Award },
];

const LEARNING_NAV: NavItem[] = [
  { href: "/upload", label: "Learning Tools", description: "Extract & vision analysis", icon: UploadCloud },
  { href: "/history", label: "History", description: "Study timeline & archive", icon: HistoryIcon },
  { href: "/summaries", label: "Saved Items", description: "Generated notes & summaries", icon: Bookmark },
  { href: "/chat", label: "Dialogue", description: "Socratic AI chat", icon: MessageSquare },
];

const ACCOUNT_NAV: NavItem[] = [
  { href: "/settings", label: "Settings", description: "Preferences & Telegram link", icon: Settings },
];

export default function Navbar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("studymate_sidebar_collapsed");
    if (saved !== null) {
      setCollapsed(saved === "true");
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    api.getMe().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, [pathname]);

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    window.location.href = "/";
  };

  const handleToggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("studymate_sidebar_collapsed", String(next));
  };

  // Reusable link class builder
  const navLinkClass = (active: boolean, extraClass = "") =>
    [
      "flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium transition group",
      active
        ? "bg-midnight-750 dark:bg-midnight-750 text-scholar-emerald border border-midnight-600/60 shadow-xs"
        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-midnight-800",
      extraClass,
    ].join(" ");

  const iconClass = (active: boolean) =>
    active
      ? "text-scholar-emerald"
      : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-200";

  const renderNavSection = (items: NavItem[], label: string) => (
    <section aria-label={`${label} navigation`}>
      {!collapsed && (
        <div className="px-3 text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
          {label}
        </div>
      )}
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? `${item.label} — ${item.description}` : undefined}
              className={navLinkClass(active, collapsed ? "justify-center" : "")}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${iconClass(active)}`} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </div>
    </section>
  );

  const mobileLinkClass = (active: boolean) =>
    [
      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition",
      active
        ? "bg-midnight-750 text-scholar-emerald border border-midnight-600"
        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-midnight-800",
    ].join(" ");

  return (
    <>
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 h-14 bg-white dark:bg-midnight-850 border-b border-slate-200 dark:border-midnight-700 z-40 text-slate-800 dark:text-slate-200">
        <Link href="/" className="flex items-center gap-2.5 font-serif font-bold text-base tracking-tight text-slate-900 dark:text-slate-100">
          <span className="w-7 h-7 rounded border border-slate-200 dark:border-midnight-600 bg-slate-50 dark:bg-midnight-800 flex items-center justify-center font-mono text-xs font-semibold text-scholar-emerald">
            SM
          </span>
          <span>StudyMate</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-midnight-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-midnight-700 text-slate-500 dark:text-slate-400"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-14 bg-white/95 dark:bg-midnight-900/95 z-50 p-4 overflow-y-auto space-y-6">
          {[
            { items: MAIN_NAV, label: "Main" },
            { items: LEARNING_NAV, label: "Learning" },
            { items: ACCOUNT_NAV, label: "Account" },
          ].map(({ items, label }) => (
            <div key={label}>
              <div className="text-[11px] font-mono tracking-wider uppercase text-slate-400 dark:text-slate-500 mb-2 px-2">
                {label}
              </div>
              <div className="space-y-1">
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={mobileLinkClass(pathname === item.href)}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {/* Mobile Auth Bar */}
          <div className="pt-4 border-t border-slate-200 dark:border-midnight-700">
            {currentUser ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-midnight-950 border border-slate-200 dark:border-midnight-700">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {currentUser.name || "Scholar"}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">{currentUser.email}</div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-midnight-700 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-midnight-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                >
                  <LogIn className="w-3.5 h-3.5 text-scholar-emerald" />
                  <span>Sign In</span>
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-scholar-emerald text-white text-xs font-semibold"
                >
                  <span>Register</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Desktop Collapsible Academic Sidebar */}
      <aside
        className={`hidden md:flex flex-col flex-shrink-0 bg-white dark:bg-midnight-850 border-r border-slate-200 dark:border-midnight-700 text-slate-600 dark:text-slate-300 transition-all duration-200 select-none ${
          collapsed ? "w-16" : "w-60"
        }`}
        aria-label="Sidebar Navigation"
      >
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 dark:border-midnight-700">
          <Link
            href="/"
            className="flex items-center gap-2.5 overflow-hidden"
            title="StudyMate — Academic Learning Workspace"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-midnight-800 border border-slate-200 dark:border-midnight-600 flex items-center justify-center flex-shrink-0 text-scholar-emerald font-serif font-bold text-sm">
              SM
            </div>
            {!collapsed && (
              <div className="leading-tight">
                <span className="font-serif font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight block">
                  StudyMate
                </span>
                <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500 tracking-wider block">
                  Workspace
                </span>
              </div>
            )}
          </Link>
          <button
            onClick={handleToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-midnight-700 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
          {renderNavSection(MAIN_NAV, "Main")}
          {renderNavSection(LEARNING_NAV, "Learning")}
          {renderNavSection(ACCOUNT_NAV, "Account")}
        </div>

        {/* User Account / Sign In Pill */}
        <div className="p-2 border-t border-slate-200 dark:border-midnight-700">
          {currentUser ? (
            <div
              className={`flex items-center gap-2 p-1.5 rounded-lg bg-slate-50 dark:bg-midnight-950 border border-slate-200 dark:border-midnight-700 ${
                collapsed ? "justify-center" : "justify-between"
              }`}
            >
              <Link
                href="/settings"
                title={`${currentUser.name || currentUser.email} — View Settings`}
                className="flex items-center gap-2 min-w-0"
              >
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-scholar-emerald flex items-center justify-center font-mono text-[10px] font-bold flex-shrink-0">
                  {(currentUser.name?.[0] || currentUser.email[0]).toUpperCase()}
                </div>
                {!collapsed && (
                  <div className="truncate text-left leading-tight">
                    <span className="block text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {currentUser.name || "Scholar"}
                    </span>
                    <span className="block text-[9px] font-mono text-slate-400 truncate">
                      {currentUser.email}
                    </span>
                  </div>
                )}
              </Link>
              {!collapsed && (
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Sign Out"
                  className="p-1 rounded text-slate-400 hover:text-red-500 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              title="Sign In to StudyMate"
              className={`flex items-center gap-2 p-2 rounded-lg bg-slate-100 dark:bg-midnight-800 hover:bg-slate-200 dark:hover:bg-midnight-700 text-xs font-semibold text-slate-800 dark:text-slate-200 transition ${
                collapsed ? "justify-center" : ""
              }`}
            >
              <LogIn className="w-4 h-4 text-scholar-emerald flex-shrink-0" />
              {!collapsed && <span>Sign In</span>}
            </Link>
          )}
        </div>

        {/* Footer: Theme Toggle */}
        <div className="p-3 border-t border-slate-200 dark:border-midnight-700">
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-midnight-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs transition w-full justify-center"
          >
            {theme === "dark" ? (
              <>
                <Sun className="w-4 h-4 text-amber-400 flex-shrink-0" />
                {!collapsed && <span>Light theme</span>}
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-slate-500 dark:text-slate-300 flex-shrink-0" />
                {!collapsed && <span>Dark theme</span>}
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

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
} from "lucide-react";
import { useTheme } from "./ThemeProvider";

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

  useEffect(() => {
    const saved = localStorage.getItem("studymate_sidebar_collapsed");
    if (saved !== null) {
      setCollapsed(saved === "true");
    }
    setMounted(true);
  }, []);

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

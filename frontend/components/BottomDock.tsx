"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Timer,
  Calculator,
  Award,
  MessageSquare,
  FileText,
  BarChart2,
  Palette,
  Settings,
  LucideIcon,
} from "lucide-react";
import { useFocus } from "./FocusContext";

interface DockItem {
  id: string;
  label: string;
  href?: string;
  action?: () => void;
  icon: LucideIcon;
}

export default function BottomDock() {
  const pathname = usePathname();
  const {
    isControlsVisible,
    prefersReducedMotion,
    setIsScenePickerOpen,
    setOverlayOpen,
  } = useFocus();

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);

  const items: DockItem[] = [
    { id: "focus", label: "Focus Timer", href: "/", icon: Timer },
    { id: "solve", label: "Solve Questions", href: "/solve", icon: Calculator },
    { id: "quizzes", label: "Quizzes", href: "/quizzes", icon: Award },
    { id: "chat", label: "AI Tutor Chat", href: "/chat", icon: MessageSquare },
    { id: "summaries", label: "Study Notes", href: "/summaries", icon: FileText },
    { id: "history", label: "Analytics & History", href: "/history", icon: BarChart2 },
    {
      id: "scenes",
      label: "Background Scenes",
      action: () => setIsScenePickerOpen(true),
      icon: Palette,
    },
    { id: "settings", label: "Settings", href: "/settings", icon: Settings },
  ];

  // Keyboard navigation across dock items
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (!dockRef.current) return;
    const buttons = dockRef.current.querySelectorAll<HTMLElement>(
      'a[role="button"], button[role="button"]'
    );
    if (!buttons || buttons.length === 0) return;

    if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextIndex = (index + 1) % buttons.length;
      buttons[nextIndex]?.focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIndex = (index - 1 + buttons.length) % buttons.length;
      buttons[prevIndex]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      buttons[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      buttons[buttons.length - 1]?.focus();
    }
  };

  // Transition & Auto-hide classes
  const transitionClass = prefersReducedMotion
    ? "transition-opacity duration-200"
    : "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]";

  const visibilityClass = isControlsVisible
    ? "opacity-100 translate-y-0"
    : "opacity-0 translate-y-16 pointer-events-none";

  return (
    <nav
      aria-label="Application dock navigation"
      className={`fixed bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[96vw] sm:max-w-none ${transitionClass} ${visibilityClass}`}
    >
      <div
        ref={dockRef}
        role="toolbar"
        aria-orientation="horizontal"
        className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full bg-[#1C1F26]/85 backdrop-blur-xl border border-[#2E333D] shadow-dock"
      >
        {items.map((item, index) => {
          const Icon = item.icon;
          const isActive = item.href ? pathname === item.href : false;
          const isHovered = hoveredId === item.id;

          const buttonContent = (
            <div className="relative flex flex-col items-center justify-center">
              {/* Tooltip on hover/focus */}
              {isHovered && (
                <div
                  role="tooltip"
                  className="absolute -top-10 px-2.5 py-1 rounded-lg bg-[#242832] border border-[#2E333D] text-[11px] font-medium text-[#E8EAF0] shadow-lg whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95 duration-150 z-50"
                >
                  {item.label}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#242832] border-b border-r border-[#2E333D] rotate-45" />
                </div>
              )}

              {/* Icon Container */}
              <div
                className={`relative flex items-center justify-center w-11 h-11 sm:w-11 sm:h-11 rounded-full transition-all duration-200 ease-out ${
                  isActive
                    ? "bg-[#3B6CFF]/15 text-[#3B6CFF] shadow-[0_0_12px_rgba(59,108,255,0.25)]"
                    : "text-[#A0A6B4] hover:text-[#E8EAF0] hover:bg-[#242832]/80"
                } ${isHovered && !prefersReducedMotion ? "scale-110" : ""}`}
              >
                <Icon className="w-[22px] h-[22px]" strokeWidth={1.75} />

                {/* Tiny dot indicator for active route */}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#3B6CFF] shadow-[0_0_6px_#3B6CFF]"
                  />
                )}
              </div>
            </div>
          );

          if (item.href) {
            return (
              <Link
                key={item.id}
                href={item.href}
                role="button"
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                tabIndex={0}
                onKeyDown={(e) => handleKeyDown(e, index)}
                onMouseEnter={() => {
                  setHoveredId(item.id);
                  setOverlayOpen(true);
                }}
                onMouseLeave={() => {
                  setHoveredId(null);
                  setOverlayOpen(false);
                }}
                onFocus={() => {
                  setHoveredId(item.id);
                  setOverlayOpen(true);
                }}
                onBlur={() => {
                  setHoveredId(null);
                  setOverlayOpen(false);
                }}
                className="outline-none focus-visible:ring-2 focus-visible:ring-[#3B6CFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1C1F26] rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                {buttonContent}
              </Link>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              role="button"
              aria-label={item.label}
              tabIndex={0}
              onClick={item.action}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onMouseEnter={() => {
                setHoveredId(item.id);
                setOverlayOpen(true);
              }}
              onMouseLeave={() => {
                setHoveredId(null);
                setOverlayOpen(false);
              }}
              onFocus={() => {
                setHoveredId(item.id);
                setOverlayOpen(true);
              }}
              onBlur={() => {
                setHoveredId(null);
                setOverlayOpen(false);
              }}
              className="outline-none focus-visible:ring-2 focus-visible:ring-[#3B6CFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1C1F26] rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              {buttonContent}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

"use client";

import React, { useState, useRef, useEffect } from "react";
import { Plus, ListChecks, Play, Palette, X } from "lucide-react";
import { useFocus } from "./FocusContext";
import { useRouter } from "next/navigation";

export default function QuickActionButton() {
  const router = useRouter();
  const {
    isControlsVisible,
    prefersReducedMotion,
    startTimer,
    isTimerRunning,
    setIsScenePickerOpen,
    addTask,
    setOverlayOpen,
  } = useFocus();

  const [isOpen, setIsOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [newTaskInput, setNewTaskInput] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOverlayOpen(isOpen || taskModalOpen);
  }, [isOpen, taskModalOpen, setOverlayOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleStartSession = () => {
    startTimer();
    setIsOpen(false);
    router.push("/");
  };

  const handleOpenScenePicker = () => {
    setIsOpen(false);
    setIsScenePickerOpen(true);
  };

  const handleOpenAddTask = () => {
    setIsOpen(false);
    setTaskModalOpen(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskInput.trim()) {
      addTask(newTaskInput.trim());
      setNewTaskInput("");
      setTaskModalOpen(false);
    }
  };

  // Visibility classes
  const transitionClass = prefersReducedMotion
    ? "transition-opacity duration-200"
    : "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]";

  const visibilityClass = isControlsVisible
    ? "opacity-100 translate-y-0"
    : "opacity-0 translate-y-16 pointer-events-none";

  return (
    <>
      <div
        ref={menuRef}
        className={`fixed bottom-20 sm:bottom-6 right-4 sm:right-8 z-40 quick-action-btn ${transitionClass} ${visibilityClass}`}
      >
        {/* Quick Actions Popover Menu */}
        {isOpen && (
          <div
            role="menu"
            aria-label="Quick actions menu"
            className="absolute bottom-14 right-0 mb-2 w-56 p-1.5 rounded-2xl bg-[#1C1F26] border border-[#2E333D] shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 space-y-1 z-50"
          >
            <button
              type="button"
              role="menuitem"
              onClick={handleOpenAddTask}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#E8EAF0] hover:bg-[#242832] hover:text-white transition text-left"
            >
              <ListChecks className="w-4 h-4 text-[#3B6CFF]" />
              <span>Add task</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={handleStartSession}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#E8EAF0] hover:bg-[#242832] hover:text-white transition text-left"
            >
              <Play className="w-4 h-4 text-[#3B6CFF]" />
              <span>{isTimerRunning ? "View focus timer" : "Start focus session"}</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={handleOpenScenePicker}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#E8EAF0] hover:bg-[#242832] hover:text-white transition text-left"
            >
              <Palette className="w-4 h-4 text-[#3B6CFF]" />
              <span>Change scene</span>
            </button>
          </div>
        )}

        {/* Circular Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label="Quick actions menu"
          title="Quick actions"
          className="w-12 h-12 rounded-full bg-[#3B6CFF] hover:bg-[#5A82FF] active:bg-[#2A55D9] text-white flex items-center justify-center shadow-[0_0_20px_rgba(59,108,255,0.4)] transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#14161A]"
        >
          <Plus
            className={`w-6 h-6 transition-transform duration-200 ${
              isOpen ? "rotate-45" : ""
            }`}
          />
        </button>
      </div>

      {/* Quick Add Task Modal */}
      {taskModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-task-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md bg-[#1C1F26] border border-[#2E333D] rounded-2xl p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#262A33]">
              <h2 id="quick-task-title" className="text-base font-semibold text-[#E8EAF0]">
                Add Study Task
              </h2>
              <button
                type="button"
                onClick={() => setTaskModalOpen(false)}
                className="p-1 rounded-lg text-[#A0A6B4] hover:text-[#E8EAF0] hover:bg-[#242832] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-4">
              <input
                type="text"
                autoFocus
                placeholder="What are you working on?"
                value={newTaskInput}
                onChange={(e) => setNewTaskInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#14161A] border border-[#2E333D] text-sm text-[#E8EAF0] placeholder:text-[#6B7280] focus:border-[#3B6CFF] outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTaskModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#2E333D] text-xs font-medium text-[#A0A6B4] hover:bg-[#242832] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTaskInput.trim()}
                  className="px-4 py-2 rounded-xl bg-[#3B6CFF] hover:bg-[#5A82FF] active:bg-[#2A55D9] disabled:opacity-50 text-xs font-semibold text-white shadow-[0_0_12px_rgba(59,108,255,0.3)] transition"
                >
                  Add Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Check,
  Trash2,
  Edit2,
  ChevronUp,
  ChevronDown,
  Target,
  Calculator,
  Award,
  UploadCloud,
  FileText,
  MessageSquare,
  Search,
  ArrowRight,
  Flame,
  ListChecks,
} from "lucide-react";
import { useFocus, TimerMode } from "@/components/FocusContext";

const STUDY_TOOLS = [
  {
    href: "/solve",
    title: "Solve Questions",
    description: "Instant answer & step-by-step derivation for math, logic, and concepts.",
    icon: Calculator,
    badge: "Instant Solve",
  },
  {
    href: "/quizzes",
    title: "Practice Quizzes",
    description: "Generate adaptive quizzes with practice mode and timed exams.",
    icon: Award,
    badge: "Self-Test",
  },
  {
    href: "/chat",
    title: "AI Tutor Chat",
    description: "Multi-turn academic discussion with structured explanations.",
    icon: MessageSquare,
    badge: "Interactive",
  },
  {
    href: "/summaries",
    title: "Study Notes",
    description: "Condense lectures and textbook chapters into exam notes.",
    icon: FileText,
    badge: "Revision",
  },
  {
    href: "/upload",
    title: "Image Reader",
    description: "Extract equations and diagrams from lecture slides and scans.",
    icon: UploadCloud,
    badge: "OCR",
  },
];

export default function FocusWorkspaceHomePage() {
  const router = useRouter();
  const {
    timerMode,
    timeLeft,
    totalTime,
    isTimerRunning,
    completedSessions,
    startTimer,
    pauseTimer,
    resetTimer,
    switchMode,
    tasks,
    activeTaskId,
    addTask,
    toggleTask,
    deleteTask,
    editTask,
    setActiveTask,
    reorderTasks,
  } = useFocus();

  const [newTaskInput, setNewTaskInput] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskText, setEditingTaskText] = useState("");
  const [studyQuery, setStudyQuery] = useState("");

  // Format MM:SS
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;

  // Circular progress calculations
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = totalTime > 0 ? timeLeft / totalTime : 0;
  const strokeDashoffset = circumference - progressRatio * circumference;

  const activeTask = tasks.find((t) => t.id === activeTaskId);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskInput.trim()) {
      addTask(newTaskInput.trim());
      setNewTaskInput("");
    }
  };

  const handleStartEdit = (task: { id: string; text: string }) => {
    setEditingTaskId(task.id);
    setEditingTaskText(task.text);
  };

  const handleSaveEdit = (id: string) => {
    if (editingTaskText.trim()) {
      editTask(id, editingTaskText.trim());
    }
    setEditingTaskId(null);
  };

  const handleSolveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (studyQuery.trim()) {
      router.push(`/solve?q=${encodeURIComponent(studyQuery.trim())}`);
    }
  };

  return (
    <div className="space-y-12 sm:space-y-16">
      {/* 1. FOCUS SECTION (Timer + Task List) */}
      <section
        aria-label="Focus workspace"
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
      >
        {/* TIMER COLUMN (7 cols on lg) */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center p-6 sm:p-10 rounded-2xl bg-[#1C1F26]/90 border border-[#2E333D] shadow-xl relative overflow-hidden backdrop-blur-sm">
          {/* Subtle blue accent glow behind timer */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-[#3B6CFF]/10 rounded-full blur-[90px] pointer-events-none" />

          {/* Mode Switcher Segmented Control */}
          <div
            role="tablist"
            aria-label="Timer modes"
            className="flex items-center p-1 rounded-full bg-[#14161A] border border-[#2E333D] mb-8 z-10"
          >
            {(["focus", "short_break", "long_break"] as TimerMode[]).map((mode) => {
              const labels: Record<TimerMode, string> = {
                focus: "Focus (25m)",
                short_break: "Short Break (5m)",
                long_break: "Long Break (15m)",
              };
              const isCurrent = timerMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={isCurrent}
                  onClick={() => switchMode(mode)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isCurrent
                      ? "bg-[#3B6CFF] text-white shadow-[0_0_12px_rgba(59,108,255,0.35)]"
                      : "text-[#A0A6B4] hover:text-[#E8EAF0]"
                  }`}
                >
                  {labels[mode]}
                </button>
              );
            })}
          </div>

          {/* Circular Progress Ring with Tabular Digits */}
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center z-10">
            <svg
              className="w-full h-full -rotate-90 transform"
              viewBox="0 0 280 280"
              aria-hidden="true"
            >
              {/* Dark Background Track */}
              <circle
                cx="140"
                cy="140"
                r={radius}
                className="stroke-[#242832]"
                strokeWidth="10"
                fill="none"
              />
              {/* Electric Blue Progress Ring */}
              <circle
                cx="140"
                cy="140"
                r={radius}
                className="stroke-[#3B6CFF] transition-all duration-1000 ease-linear"
                strokeWidth="10"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            </svg>

            {/* Inner Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#3B6CFF] font-semibold mb-1">
                {timerMode === "focus"
                  ? isTimerRunning
                    ? "Deep Study"
                    : "Ready to Focus"
                  : "Break Time"}
              </span>

              {/* Tabular Numerals Countdown */}
              <div
                className="text-5xl sm:text-6xl font-bold font-mono tracking-tight text-[#E8EAF0] [font-variant-numeric:tabular-nums]"
                aria-live="polite"
              >
                {timeFormatted}
              </div>

              {/* Active Task Subtitle in Ring */}
              {activeTask ? (
                <div
                  title={`Focus task: ${activeTask.text}`}
                  className="mt-2 px-3 py-1 rounded-full bg-[#14161A]/80 border border-[#2E333D] max-w-[200px] flex items-center gap-1.5"
                >
                  <Target className="w-3 h-3 text-[#3B6CFF] flex-shrink-0" />
                  <span className="text-xs text-[#A0A6B4] truncate">
                    {activeTask.text}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-[#6B7280] mt-2">
                  No active task selected
                </span>
              )}
            </div>
          </div>

          {/* Timer Controls */}
          <div className="flex items-center gap-4 mt-8 z-10">
            {isTimerRunning ? (
              <button
                type="button"
                onClick={pauseTimer}
                aria-label="Pause focus timer"
                className="flex items-center gap-2 px-8 py-3 rounded-full bg-[#3B6CFF] hover:bg-[#5A82FF] active:bg-[#2A55D9] text-white font-semibold text-sm shadow-[0_0_20px_rgba(59,108,255,0.35)] transition-all"
              >
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={startTimer}
                aria-label="Start focus timer"
                className="flex items-center gap-2 px-8 py-3 rounded-full bg-[#3B6CFF] hover:bg-[#5A82FF] active:bg-[#2A55D9] text-white font-semibold text-sm shadow-[0_0_20px_rgba(59,108,255,0.35)] transition-all"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Focus</span>
              </button>
            )}

            <button
              type="button"
              onClick={resetTimer}
              aria-label="Reset timer"
              title="Reset timer"
              className="p-3 rounded-full text-[#A0A6B4] hover:text-[#E8EAF0] hover:bg-[#242832] border border-[#2E333D] transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Session Counter Streak Footer */}
          <div className="flex items-center gap-2 mt-6 text-xs text-[#A0A6B4] z-10">
            <Flame className="w-3.5 h-3.5 text-[#3B6CFF]" />
            <span>
              {completedSessions === 0
                ? "No sessions completed yet today"
                : `${completedSessions} focus session${
                    completedSessions > 1 ? "s" : ""
                  } finished today`}
            </span>
          </div>
        </div>

        {/* TASK LIST COLUMN (5 cols on lg) */}
        <div className="lg:col-span-5 flex flex-col p-6 sm:p-7 rounded-2xl bg-[#1C1F26]/90 border border-[#2E333D] shadow-xl backdrop-blur-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#262A33]">
            <div className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-[#3B6CFF]" />
              <h2 className="text-base font-semibold text-[#E8EAF0]">
                Study Tasks
              </h2>
            </div>
            <span className="text-xs font-mono text-[#A0A6B4] bg-[#14161A] px-2.5 py-1 rounded-full border border-[#2E333D]">
              {tasks.filter((t) => t.completed).length}/{tasks.length} done
            </span>
          </div>

          {/* Add Task Input Form */}
          <form onSubmit={handleAddTask} className="flex gap-2">
            <input
              type="text"
              aria-label="New study task"
              placeholder="What do you need to study?"
              value={newTaskInput}
              onChange={(e) => setNewTaskInput(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-xl bg-[#14161A] border border-[#2E333D] text-sm text-[#E8EAF0] placeholder:text-[#6B7280] focus:border-[#3B6CFF] outline-none transition"
            />
            <button
              type="submit"
              disabled={!newTaskInput.trim()}
              aria-label="Add task"
              className="px-3.5 py-2 rounded-xl bg-[#3B6CFF] hover:bg-[#5A82FF] active:bg-[#2A55D9] disabled:opacity-40 text-white font-medium text-xs flex items-center gap-1 shadow-[0_0_12px_rgba(59,108,255,0.25)] transition flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add</span>
            </button>
          </form>

          {/* Task List Items */}
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {tasks.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#6B7280] border border-dashed border-[#2E333D] rounded-xl space-y-1">
                <p>No study tasks added yet.</p>
                <p className="text-[#A0A6B4]">
                  Add a task above to link it to your focus timer.
                </p>
              </div>
            ) : (
              tasks.map((task, idx) => {
                const isSelectedForFocus = activeTaskId === task.id;
                const isEditing = editingTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    className={`group flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isSelectedForFocus
                        ? "bg-[#242832] border-[#3B6CFF]/60 shadow-[0_0_10px_rgba(59,108,255,0.15)]"
                        : "bg-[#14161A] border-[#2E333D] hover:border-[#3B6CFF]/40"
                    }`}
                  >
                    {/* Left: Checkbox + Title */}
                    <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                      <button
                        type="button"
                        onClick={() => toggleTask(task.id)}
                        aria-label={
                          task.completed
                            ? `Mark "${task.text}" as incomplete`
                            : `Mark "${task.text}" as complete`
                        }
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors flex-shrink-0 ${
                          task.completed
                            ? "bg-[#3B6CFF] border-[#3B6CFF] text-white"
                            : "border-[#2E333D] hover:border-[#3B6CFF] bg-[#1C1F26]"
                        }`}
                      >
                        {task.completed && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                      </button>

                      {isEditing ? (
                        <input
                          type="text"
                          autoFocus
                          value={editingTaskText}
                          onChange={(e) => setEditingTaskText(e.target.value)}
                          onBlur={() => handleSaveEdit(task.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit(task.id);
                            if (e.key === "Escape") setEditingTaskId(null);
                          }}
                          className="flex-1 px-2 py-0.5 rounded bg-[#1C1F26] border border-[#3B6CFF] text-sm text-[#E8EAF0] outline-none"
                        />
                      ) : (
                        <span
                          onClick={() => setActiveTask(task.id)}
                          className={`text-sm truncate cursor-pointer select-none ${
                            task.completed
                              ? "text-[#6B7280] line-through"
                              : isSelectedForFocus
                              ? "text-white font-medium"
                              : "text-[#E8EAF0] hover:text-white"
                          }`}
                        >
                          {task.text}
                        </span>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Set as active focus */}
                      {!task.completed && !isSelectedForFocus && (
                        <button
                          type="button"
                          onClick={() => setActiveTask(task.id)}
                          title="Set as current focus task"
                          className="p-1 rounded text-[#A0A6B4] hover:text-[#3B6CFF] hover:bg-[#242832]"
                        >
                          <Target className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Reorder Up */}
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => reorderTasks(idx, idx - 1)}
                          title="Move up"
                          className="p-1 rounded text-[#A0A6B4] hover:text-[#E8EAF0] hover:bg-[#242832]"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Reorder Down */}
                      {idx < tasks.length - 1 && (
                        <button
                          type="button"
                          onClick={() => reorderTasks(idx, idx + 1)}
                          title="Move down"
                          className="p-1 rounded text-[#A0A6B4] hover:text-[#E8EAF0] hover:bg-[#242832]"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => handleStartEdit(task)}
                        title="Edit task"
                        className="p-1 rounded text-[#A0A6B4] hover:text-[#E8EAF0] hover:bg-[#242832]"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => deleteTask(task.id)}
                        title="Delete task"
                        className="p-1 rounded text-[#A0A6B4] hover:text-[#FF5C6C] hover:bg-[#242832]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* 2. INSTANT SOLVER SEARCH BAR */}
      <section
        aria-labelledby="quick-solve-heading"
        className="p-6 sm:p-8 rounded-2xl bg-[#1C1F26] border border-[#2E333D] shadow-xl relative overflow-hidden space-y-4"
      >
        <div className="space-y-1">
          <span className="text-xs font-mono uppercase tracking-wider text-[#3B6CFF] font-semibold">
            StudyMate Instant Solver
          </span>
          <h2 id="quick-solve-heading" className="text-xl sm:text-2xl font-bold text-[#E8EAF0]">
            Ask an academic question or paste an equation
          </h2>
          <p className="text-xs sm:text-sm text-[#A0A6B4]">
            Get worked algebraic derivations, formal truth tables, or concise conceptual explanations.
          </p>
        </div>

        <form onSubmit={handleSolveSubmit} className="flex flex-col sm:flex-row gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Question or equation to solve"
              value={studyQuery}
              onChange={(e) => setStudyQuery(e.target.value)}
              placeholder="e.g. solve 2x^2 + 5x - 3 = 0 or explain Bayes' theorem"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#14161A] border border-[#2E333D] text-sm text-[#E8EAF0] placeholder:text-[#6B7280] focus:border-[#3B6CFF] outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-[#3B6CFF] hover:bg-[#5A82FF] active:bg-[#2A55D9] text-white font-semibold text-xs sm:text-sm shadow-[0_0_12px_rgba(59,108,255,0.3)] transition flex items-center justify-center gap-2 flex-shrink-0"
          >
            <span>Solve Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </section>

      {/* 3. LEARNING TOOLS SHELF */}
      <section aria-labelledby="tools-shelf-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="tools-shelf-heading" className="text-base font-semibold text-[#E8EAF0]">
            Academic Learning Tools
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {STUDY_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className="group p-5 rounded-2xl bg-[#1C1F26] border border-[#2E333D] hover:border-[#3B6CFF]/60 hover:bg-[#242832] transition-all duration-200 flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[#14161A] border border-[#2E333D] flex items-center justify-center text-[#3B6CFF] group-hover:scale-105 group-hover:shadow-[0_0_10px_rgba(59,108,255,0.3)] transition">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono text-[#3B6CFF] bg-[#3B6CFF]/10 px-2 py-0.5 rounded-full font-medium">
                    {tool.badge}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#E8EAF0] group-hover:text-white transition">
                    {tool.title}
                  </h3>
                  <p className="text-xs text-[#A0A6B4] mt-1 line-clamp-2">
                    {tool.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

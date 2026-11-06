"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

export type TimerMode = "focus" | "short_break" | "long_break";

export interface FocusTask {
  id: string;
  text: string;
  completed: boolean;
}

export interface BackgroundScene {
  id: string;
  name: string;
  description: string;
  type: "gradient" | "mesh" | "stars" | "city" | "ocean";
  cssBackground: string;
}

export const SCENES: BackgroundScene[] = [
  {
    id: "dark-mesh",
    name: "Abstract Mesh",
    description: "Deep charcoal with royal blue ambient gradients",
    type: "mesh",
    cssBackground:
      "radial-gradient(at 10% 20%, rgba(59, 108, 255, 0.15) 0px, transparent 50%), radial-gradient(at 90% 80%, rgba(42, 85, 217, 0.12) 0px, transparent 50%), #14161A",
  },
  {
    id: "night-sky",
    name: "Night Sky",
    description: "Deep midnight with starry blue ambient glow",
    type: "stars",
    cssBackground:
      "radial-gradient(ellipse at bottom, rgba(59, 108, 255, 0.2) 0%, rgba(20, 22, 26, 0.95) 70%), #101216",
  },
  {
    id: "deep-ocean",
    name: "Deep Ocean",
    description: "Subtle abyssal oceanic blues",
    type: "ocean",
    cssBackground:
      "radial-gradient(circle at 50% 120%, rgba(30, 60, 160, 0.35) 0%, rgba(20, 22, 26, 0.95) 60%), #0D1017",
  },
  {
    id: "dim-city",
    name: "Dim City",
    description: "Moody metropolis glow at night",
    type: "city",
    cssBackground:
      "linear-gradient(to top, rgba(59, 108, 255, 0.18) 0%, rgba(20, 22, 26, 0.9) 50%, #14161A 100%)",
  },
  {
    id: "pure-charcoal",
    name: "Minimal Charcoal",
    description: "Distraction-free dark canvas",
    type: "gradient",
    cssBackground: "#14161A",
  },
];

const TIMER_DURATIONS: Record<TimerMode, number> = {
  focus: 25 * 60,
  short_break: 5 * 60,
  long_break: 15 * 60,
};

interface FocusContextType {
  // Timer
  timerMode: TimerMode;
  timeLeft: number;
  totalTime: number;
  isTimerRunning: boolean;
  completedSessions: number;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  switchMode: (mode: TimerMode) => void;

  // Tasks
  tasks: FocusTask[];
  activeTaskId: string | null;
  addTask: (text: string) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  editTask: (id: string, text: string) => void;
  setActiveTask: (id: string | null) => void;
  reorderTasks: (fromIndex: number, toIndex: number) => void;

  // Scenes
  activeScene: string;
  setActiveScene: (id: string) => void;
  isScenePickerOpen: boolean;
  setIsScenePickerOpen: (open: boolean) => void;

  // Visibility / Auto-hide in focus mode
  isControlsVisible: boolean;
  prefersReducedMotion: boolean;
  isOverlayOpen: boolean;
  setOverlayOpen: (open: boolean) => void;
}

const FocusContext = createContext<FocusContextType | undefined>(undefined);

export function FocusProvider({ children }: { children: React.ReactNode }) {
  // Timer State
  const [timerMode, setTimerMode] = useState<TimerMode>("focus");
  const [timeLeft, setTimeLeft] = useState<number>(TIMER_DURATIONS.focus);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [completedSessions, setCompletedSessions] = useState<number>(0);

  // Tasks State
  const [tasks, setTasks] = useState<FocusTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // Scene State
  const [activeScene, setActiveSceneState] = useState<string>("dark-mesh");
  const [isScenePickerOpen, setIsScenePickerOpen] = useState<boolean>(false);

  // Auto-hide & overlay state
  const [isControlsVisible, setIsControlsVisible] = useState<boolean>(true);
  const [isOverlayOpen, setIsOverlayOpen] = useState<boolean>(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);

  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize from localStorage
  useEffect(() => {
    try {
      const savedScene = localStorage.getItem("studymate_active_scene");
      if (savedScene && SCENES.some((s) => s.id === savedScene)) {
        setActiveSceneState(savedScene);
      }

      const savedSessions = localStorage.getItem("studymate_completed_sessions");
      if (savedSessions) {
        setCompletedSessions(parseInt(savedSessions, 10) || 0);
      }

      const savedTasks = localStorage.getItem("studymate_focus_tasks");
      if (savedTasks) {
        const parsed = JSON.parse(savedTasks);
        if (Array.isArray(parsed)) setTasks(parsed);
      } else {
        // Initial sample task
        setTasks([
          { id: "task-1", text: "Study algorithmic problem solving", completed: false },
          { id: "task-2", text: "Review mathematical derivations", completed: true },
        ]);
      }

      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(mq.matches);
      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    } catch {
      // ignore
    }
  }, []);

  const setActiveScene = (id: string) => {
    setActiveSceneState(id);
    try {
      localStorage.setItem("studymate_active_scene", id);
    } catch {
      // ignore
    }
  };

  // Persist tasks
  const saveTasks = (newTasks: FocusTask[]) => {
    setTasks(newTasks);
    try {
      localStorage.setItem("studymate_focus_tasks", JSON.stringify(newTasks));
    } catch {
      // ignore
    }
  };

  const addTask = (text: string) => {
    if (!text.trim()) return;
    const newTask: FocusTask = {
      id: `task-${Date.now()}`,
      text: text.trim(),
      completed: false,
    };
    const updated = [newTask, ...tasks];
    saveTasks(updated);
    if (!activeTaskId) setActiveTaskId(newTask.id);
  };

  const toggleTask = (id: string) => {
    const updated = tasks.map((t) =>
      t.id === id ? { ...t, completed: !t.completed } : t
    );
    saveTasks(updated);
  };

  const deleteTask = (id: string) => {
    const updated = tasks.filter((t) => t.id !== id);
    saveTasks(updated);
    if (activeTaskId === id) {
      const nextActive = updated.find((t) => !t.completed);
      setActiveTaskId(nextActive ? nextActive.id : null);
    }
  };

  const editTask = (id: string, text: string) => {
    const updated = tasks.map((t) => (t.id === id ? { ...t, text } : t));
    saveTasks(updated);
  };

  const reorderTasks = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const updated = [...tasks];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    saveTasks(updated);
  };

  // Timer Tick
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Timer finished
            setIsTimerRunning(false);
            setIsControlsVisible(true);
            if (timerMode === "focus") {
              setCompletedSessions((s) => {
                const next = s + 1;
                try {
                  localStorage.setItem("studymate_completed_sessions", String(next));
                } catch {}
                return next;
              });
              // Switch to break
              setTimerMode("short_break");
              return TIMER_DURATIONS.short_break;
            } else {
              setTimerMode("focus");
              return TIMER_DURATIONS.focus;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, timerMode]);

  const startTimer = useCallback(() => {
    setIsTimerRunning(true);
  }, []);

  const pauseTimer = useCallback(() => {
    setIsTimerRunning(false);
    setIsControlsVisible(true);
  }, []);

  const resetTimer = useCallback(() => {
    setIsTimerRunning(false);
    setIsControlsVisible(true);
    setTimeLeft(TIMER_DURATIONS[timerMode]);
  }, [timerMode]);

  const switchMode = useCallback((mode: TimerMode) => {
    setIsTimerRunning(false);
    setIsControlsVisible(true);
    setTimerMode(mode);
    setTimeLeft(TIMER_DURATIONS[mode]);
  }, []);

  // Auto-hide controls logic during focus session
  const showControlsTemporarily = useCallback(() => {
    setIsControlsVisible(true);
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (isTimerRunning && !isOverlayOpen && !isScenePickerOpen) {
      inactivityTimerRef.current = setTimeout(() => {
        setIsControlsVisible(false);
      }, 3000);
    }
  }, [isTimerRunning, isOverlayOpen, isScenePickerOpen]);

  useEffect(() => {
    if (!isTimerRunning || isOverlayOpen || isScenePickerOpen) {
      setIsControlsVisible(true);
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      return;
    }

    // Timer is running: start initial 3s inactivity timeout
    inactivityTimerRef.current = setTimeout(() => {
      setIsControlsVisible(false);
    }, 3000);

    const handlePointerMove = (e: MouseEvent) => {
      // If mouse is near bottom edge (within 120px) or moving, reveal
      if (e.clientY >= window.innerHeight - 120) {
        showControlsTemporarily();
      } else {
        // Any pointer movement resets the timer
        showControlsTemporarily();
      }
    };

    const handleKeyDown = () => {
      showControlsTemporarily();
    };

    const handleTouchStart = () => {
      showControlsTemporarily();
    };

    window.addEventListener("mousemove", handlePointerMove, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("touchstart", handleTouchStart, { passive: true });

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("touchstart", handleTouchStart);
    };
  }, [isTimerRunning, isOverlayOpen, isScenePickerOpen, showControlsTemporarily]);

  return (
    <FocusContext.Provider
      value={{
        timerMode,
        timeLeft,
        totalTime: TIMER_DURATIONS[timerMode],
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
        setActiveTask: setActiveTaskId,
        reorderTasks,
        activeScene,
        setActiveScene,
        isScenePickerOpen,
        setIsScenePickerOpen,
        isControlsVisible,
        prefersReducedMotion,
        isOverlayOpen,
        setOverlayOpen: setIsOverlayOpen,
      }}
    >
      {children}
    </FocusContext.Provider>
  );
}

export function useFocus() {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error("useFocus must be used within a FocusProvider");
  }
  return context;
}

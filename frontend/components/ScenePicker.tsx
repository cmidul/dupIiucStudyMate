"use client";

import React, { useEffect } from "react";
import { X, Check, Sparkles, Image as ImageIcon } from "lucide-react";
import { useFocus, SCENES } from "./FocusContext";

export default function ScenePicker() {
  const { isScenePickerOpen, setIsScenePickerOpen, activeScene, setActiveScene } = useFocus();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isScenePickerOpen) {
        setIsScenePickerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isScenePickerOpen, setIsScenePickerOpen]);

  if (!isScenePickerOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scene-picker-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg bg-[#1C1F26] border border-[#2E333D] rounded-2xl p-6 shadow-2xl relative space-y-5">
        <div className="flex items-center justify-between pb-2 border-b border-[#262A33]">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-[#3B6CFF]" />
            <h2 id="scene-picker-title" className="text-base font-semibold text-[#E8EAF0]">
              Background Scenes
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setIsScenePickerOpen(false)}
            aria-label="Close background scenes picker"
            className="p-1.5 rounded-lg text-[#A0A6B4] hover:text-[#E8EAF0] hover:bg-[#242832] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#A0A6B4]">
          Choose an ambient dark background scene for your study workspace. Text readability is preserved with a dark overlay.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
          {SCENES.map((scene) => {
            const isSelected = activeScene === scene.id;
            return (
              <button
                key={scene.id}
                type="button"
                onClick={() => {
                  setActiveScene(scene.id);
                  setIsScenePickerOpen(false);
                }}
                className={`relative flex flex-col text-left p-3.5 rounded-xl border transition-all group overflow-hidden ${
                  isSelected
                    ? "border-[#3B6CFF] ring-2 ring-[#3B6CFF]/30 bg-[#242832]"
                    : "border-[#2E333D] bg-[#14161A] hover:border-[#3B6CFF]/50 hover:bg-[#242832]/60"
                }`}
              >
                {/* Visual Preview Mini Box */}
                <div
                  className="w-full h-16 rounded-lg mb-2.5 border border-[#2E333D] relative overflow-hidden flex items-center justify-center"
                  style={{ background: scene.cssBackground }}
                >
                  <div className="absolute inset-0 bg-[#14161A]/40" />
                  {isSelected && (
                    <div className="relative w-6 h-6 rounded-full bg-[#3B6CFF] text-white flex items-center justify-center shadow-[0_0_10px_rgba(59,108,255,0.5)]">
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between w-full">
                  <span className="text-sm font-medium text-[#E8EAF0] group-hover:text-white transition">
                    {scene.name}
                  </span>
                  {isSelected && (
                    <span className="text-[10px] font-mono uppercase font-semibold text-[#3B6CFF] bg-[#3B6CFF]/10 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <span className="text-xs text-[#A0A6B4] mt-0.5 line-clamp-1">
                  {scene.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

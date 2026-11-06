"use client";

import React, { useMemo } from "react";
import { useFocus, SCENES } from "./FocusContext";

export default function BackgroundScene() {
  const { activeScene } = useFocus();

  const currentScene = useMemo(() => {
    return SCENES.find((s) => s.id === activeScene) || SCENES[0];
  }, [activeScene]);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 pointer-events-none overflow-hidden transition-all duration-700 ease-out"
      style={{
        background: currentScene.cssBackground,
      }}
    >
      {/* Dark tint overlay (55% to 70%) to guarantee WCAG AA readability on all text */}
      <div className="absolute inset-0 bg-[#14161A]/65 backdrop-blur-[1px]" />

      {/* Subtle royal blue ambient glow highlight */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#3B6CFF]/[0.07] rounded-full blur-[120px] pointer-events-none" />
    </div>
  );
}

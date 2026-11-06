import "./globals.css";
import "katex/dist/katex.min.css";
import React from "react";
import { FocusProvider } from "@/components/FocusContext";
import BackgroundScene from "@/components/BackgroundScene";
import TopBar from "@/components/TopBar";
import BottomDock from "@/components/BottomDock";
import QuickActionButton from "@/components/QuickActionButton";
import ScenePicker from "@/components/ScenePicker";

export const metadata = {
  title: "StudyMate — Multimodal AI Learning & Focus Workspace",
  description:
    "Distraction-free AI learning workspace with focus timer, background scenes, mathematical solving, logical reasoning, and study tools.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#14161A] text-[#E8EAF0] flex flex-col antialiased selection:bg-[#3B6CFF]/30 selection:text-white relative">
        <FocusProvider>
          {/* Ambient Background Scene Layer */}
          <BackgroundScene />

          {/* Minimal Top Header */}
          <TopBar />

          {/* Main Content Area - Full width with centered max width, with top padding for header and bottom padding for dock */}
          <main
            id="workspace"
            className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 pt-16 sm:pt-20 pb-28 sm:pb-32 flex flex-col min-w-0"
          >
            {children}
          </main>

          {/* Floating Quick Action Button */}
          <QuickActionButton />

          {/* Floating Bottom Dock */}
          <BottomDock />

          {/* Background Scene Selector Modal */}
          <ScenePicker />
        </FocusProvider>
      </body>
    </html>
  );
}

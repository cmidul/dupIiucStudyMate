import "./globals.css";
import React from "react";
import Navbar from "@/components/Navbar";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata = {
  title: "StudyMate — Academic Learning Workspace",
  description: "Multimodal AI research and learning workspace with mathematical solving, logical reasoning, and structured study tools.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col md:flex-row bg-[#0b0f19] text-slate-100 dark:bg-[#0b0f19] dark:text-slate-100 transition-colors duration-150 antialiased selection:bg-emerald-500/20 selection:text-emerald-300">
        <ThemeProvider>
          <Navbar />
          <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}

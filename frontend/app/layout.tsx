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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400..700;1,400..700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-midnight-900 text-slate-900 dark:text-slate-100 transition-colors duration-150 antialiased selection:bg-emerald-500/20 selection:text-emerald-300">
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

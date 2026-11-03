import "./globals.css";
import React from "react";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "AI Learning Assistant — StudyMate",
  description: "Multimodal AI Learning Assistant for students and lifelong learners",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-900 antialiased">
        <Navbar />
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}


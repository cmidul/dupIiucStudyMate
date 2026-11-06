"use client";

import React from "react";
import Link from "next/link";
import { Compass, ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-[#1C1F26] border border-[#2E333D] flex items-center justify-center text-[#3B6CFF] shadow-[0_0_20px_rgba(59,108,255,0.25)]">
        <Compass className="w-8 h-8" />
      </div>
      <div className="space-y-1">
        <span className="text-xs font-mono uppercase tracking-wider text-[#3B6CFF] font-semibold">
          Error 404
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#E8EAF0]">
          Page Not Found
        </h1>
        <p className="text-xs sm:text-sm text-[#A0A6B4] max-w-sm mx-auto">
          The requested study workspace page or resource could not be found.
        </p>
      </div>

      <div className="pt-2">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#3B6CFF] hover:bg-[#5A82FF] active:bg-[#2A55D9] text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-[0_0_15px_rgba(59,108,255,0.35)]"
        >
          <span>Return to Focus Workspace</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

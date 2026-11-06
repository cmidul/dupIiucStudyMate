"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { api, ExtractedContent, BackgroundJob } from "@/lib/api";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<BackgroundJob | null>(null);
  const [extracted, setExtracted] = useState<ExtractedContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMsg(null);
      setExtracted(null);
      setJob(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setErrorMsg(null);
      setExtracted(null);
      setJob(null);
    }
  };

  const pollJob = async (jobId: string, uploadId: string) => {
    const interval = setInterval(async () => {
      try {
        const j = await api.getJobStatus(jobId);
        setJob(j);
        if (j.status === "completed") {
          clearInterval(interval);
          setLoading(false);
          const content = await api.getExtractedContent(uploadId);
          setExtracted(content);
        } else if (j.status === "failed") {
          clearInterval(interval);
          setLoading(false);
          setErrorMsg(j.error_message || "Image analysis failed.");
        }
      } catch (err: unknown) {
        clearInterval(interval);
        setLoading(false);
        const error = err as { message?: string };
        setErrorMsg(error.message || "Failed to inspect processing job status.");
      }
    }, 1500);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await api.uploadImage(file);
      setJob({
        id: res.job_id,
        job_type: "image_processing",
        status: "queued",
        progress: 0,
      });
      pollJob(res.job_id, res.file.id);
    } catch (err: unknown) {
      setLoading(false);
      const error = err as { message?: string };
      setErrorMsg(error.message || "Upload failed. Please check file type and size.");
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-[#2E333D] pb-5">
        <h1 className="text-xl sm:text-2xl font-bold text-[#E8EAF0] tracking-tight">
          Image Reader & OCR
        </h1>
        <p className="text-xs sm:text-sm text-[#A0A6B4] mt-0.5">
          Extract text, diagrams, and mathematical symbols from photos, lecture slides, or scans.
        </p>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-[#2E333D] hover:border-[#3B6CFF] rounded-2xl p-8 sm:p-14 text-center cursor-pointer bg-[#1C1F26] hover:bg-[#242832]/60 transition-all flex flex-col items-center justify-center space-y-3 shadow-xl group"
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
        />
        <div className="w-14 h-14 rounded-2xl bg-[#14161A] border border-[#2E333D] text-[#3B6CFF] flex items-center justify-center group-hover:scale-105 group-hover:shadow-[0_0_15px_rgba(59,108,255,0.3)] transition">
          <UploadCloud className="w-7 h-7" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#E8EAF0]">
            {file ? file.name : "Select an image or drop file here"}
          </p>
          <p className="text-xs text-[#6B7280] mt-1 font-mono">
            Accepted: PNG, JPEG, WEBP (Max 10MB)
          </p>
        </div>
      </div>

      {file && !loading && !extracted && (
        <div className="flex justify-end">
          <button
            onClick={handleUpload}
            className="px-6 py-2.5 bg-[#3B6CFF] hover:bg-[#5A82FF] active:bg-[#2A55D9] text-white rounded-xl text-xs font-semibold transition flex items-center gap-2 shadow-[0_0_15px_rgba(59,108,255,0.35)]"
          >
            <span>Extract & Parse Contents</span>
            <Sparkles className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Processing Status Indicator */}
      {loading && job && (
        <div className="p-5 bg-[#1C1F26] border border-[#2E333D] rounded-2xl text-xs space-y-3 shadow-xl">
          <div className="flex items-center justify-between text-[#E8EAF0] font-medium">
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#3B6CFF]" />
              <span>Analyzing image contents and mathematical expressions...</span>
            </span>
            <span className="font-mono text-[11px] uppercase text-[#3B6CFF] font-semibold">
              {job.status}
            </span>
          </div>
          <div className="w-full bg-[#14161A] rounded-full h-2 overflow-hidden border border-[#2E333D]">
            <div
              className="bg-[#3B6CFF] h-full transition-all duration-300"
              style={{ width: `${Math.max(job.progress || 35, 25)}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 bg-[#FF5C6C]/10 border border-[#FF5C6C]/30 text-[#FF5C6C] rounded-2xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Extracted Content Result */}
      {extracted && (
        <div className="bg-[#1C1F26] border border-[#2E333D] rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#262A33] pb-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#3DDC97] mb-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Text and Concepts Extracted</span>
              </div>
              <h2 className="text-xl font-bold text-[#E8EAF0]">
                {extracted.title}
              </h2>
              <p className="text-xs font-mono text-[#A0A6B4] mt-0.5">
                {extracted.subject} → {extracted.topic}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/solve"
                className="px-4 py-2 bg-[#3B6CFF] hover:bg-[#5A82FF] active:bg-[#2A55D9] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-[0_0_12px_rgba(59,108,255,0.25)]"
              >
                <span>Solve in Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Uncertainty Warnings */}
          {extracted.uncertainties && extracted.uncertainties.length > 0 && (
            <div className="p-3.5 bg-[#F5B84B]/10 border border-[#F5B84B]/30 rounded-xl text-xs text-[#F5B84B] space-y-1">
              <span className="font-semibold uppercase tracking-wider font-mono">
                Notice:
              </span>
              <p>{extracted.uncertainties.join("; ")}</p>
            </div>
          )}

          {/* Extracted Text */}
          <div className="space-y-2">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#3B6CFF] font-semibold">
              Extracted Problem Text
            </h3>
            <div className="p-4 bg-[#14161A] border border-[#2E333D] rounded-xl text-xs sm:text-sm text-[#E8EAF0] whitespace-pre-wrap leading-relaxed font-sans">
              {extracted.extracted_text}
            </div>
          </div>

          {/* Key Concepts & Equations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {extracted.key_concepts && extracted.key_concepts.length > 0 && (
              <div className="p-4 bg-[#14161A] rounded-xl border border-[#2E333D] space-y-2">
                <h4 className="text-xs font-mono uppercase tracking-wider text-[#3B6CFF] font-semibold">
                  Identified Concepts
                </h4>
                <ul className="list-disc list-inside text-xs sm:text-sm text-[#A0A6B4] space-y-1">
                  {extracted.key_concepts.map((kc, i) => (
                    <li key={i} className="text-[#E8EAF0]">{kc}</li>
                  ))}
                </ul>
              </div>
            )}

            {extracted.equations && extracted.equations.length > 0 && (
              <div className="p-4 bg-[#14161A] rounded-xl border border-[#2E333D] space-y-2">
                <h4 className="text-xs font-mono uppercase tracking-wider text-[#3B6CFF] font-semibold">
                  Equations & Formulas
                </h4>
                <ul className="list-disc list-inside text-xs sm:text-sm text-[#E8EAF0] space-y-1 font-mono">
                  {extracted.equations.map((eq, i) => (
                    <li key={i}>{eq}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

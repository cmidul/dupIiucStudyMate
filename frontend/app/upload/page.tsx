"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import {
  UploadCloud,
  FileImage,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
  Award,
  Sparkles,
  ArrowRight,
  BookOpen,
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
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8 w-full">
      {/* Header */}
      <div className="page-heading border-b border-slate-200 dark:border-midnight-700 pb-5">
        <h1 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 dark:text-slate-100 mt-1">
          Image reader
        </h1>
        <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Extract text and equations from a photo, scan, or slide.
        </p>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-scholar-emerald dark:hover:border-scholar-emerald rounded-2xl p-8 md:p-12 text-center cursor-pointer bg-white dark:bg-midnight-900 transition flex flex-col items-center justify-center space-y-3 shadow-sm group"
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
        />
        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-midnight-800 text-scholar-emerald flex items-center justify-center group-hover:scale-105 transition">
          <UploadCloud className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {file ? file.name : "Select an academic image or drag and drop file"}
          </p>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Accepted: PNG, JPEG, WEBP (Maximum 10MB)
          </p>
        </div>
      </div>

      {file && !loading && !extracted && (
        <div className="flex justify-end">
          <button
            onClick={handleUpload}
            className="px-6 py-2.5 bg-slate-900 dark:bg-scholar-emerald hover:bg-slate-800 dark:hover:bg-emerald-600 text-white dark:text-slate-950 rounded-xl text-xs font-semibold transition flex items-center gap-2 shadow-sm"
          >
            <span>Execute OCR & Structural Parsing</span>
            <Sparkles className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Processing Status Indicator */}
      {loading && job && (
        <div className="p-5 bg-white dark:bg-midnight-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs space-y-3 shadow-sm">
          <div className="flex items-center justify-between text-slate-800 dark:text-slate-200 font-medium">
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-scholar-emerald" />
              <span>Parsing layout, mathematical expressions, and visual tokens...</span>
            </span>
            <span className="font-mono text-[11px] uppercase text-scholar-emerald">{job.status}</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-midnight-950 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-scholar-emerald h-full transition-all duration-300"
              style={{ width: `${Math.max(job.progress || 35, 25)}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Extracted Content Result */}
      {extracted && (
        <div className="workspace-panel p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-scholar-emerald mb-1">
                <CheckCircle2 className="w-4 h-4 text-scholar-emerald" />
                <span>Extracted Structural Context Ready</span>
              </div>
              <h2 className="text-xl font-serif font-bold text-slate-900 dark:text-slate-100">
                {extracted.title}
              </h2>
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                {extracted.subject} → {extracted.topic}
              </p>
            </div>

            {/* Quick Actions for Reusable Context */}
            <div className="flex items-center gap-2">
              <Link
                href={`/solve`}
                className="px-3.5 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <span>Solve in Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Uncertainty Warnings */}
          {extracted.uncertainties && extracted.uncertainties.length > 0 && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-600 dark:text-amber-400 space-y-1">
              <span className="font-semibold uppercase tracking-wider font-mono">Attention (Low OCR Confidence):</span>
              <p>{extracted.uncertainties.join("; ")}</p>
            </div>
          )}

          {/* Extracted Text */}
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-2">
              Extracted Manuscript / Problem Text
            </h3>
            <div className="p-4 bg-slate-50 dark:bg-midnight-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs md:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
              {extracted.extracted_text}
            </div>
          </div>

          {/* Key Concepts & Equations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {extracted.key_concepts && extracted.key_concepts.length > 0 && (
              <div className="p-4 bg-slate-50 dark:bg-midnight-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-2">
                  Identified Concepts
                </h4>
                <ul className="list-disc list-inside text-xs text-slate-700 dark:text-slate-300 space-y-1">
                  {extracted.key_concepts.map((kc, i) => (
                    <li key={i}>{kc}</li>
                  ))}
                </ul>
              </div>
            )}

            {extracted.equations && extracted.equations.length > 0 && (
              <div className="p-4 bg-slate-50 dark:bg-midnight-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-2">
                  Formulas & Expressions
                </h4>
                <ul className="list-disc list-inside text-xs text-slate-700 dark:text-slate-300 space-y-1 font-mono">
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

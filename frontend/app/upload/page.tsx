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
    <div className="p-6 max-w-4xl mx-auto space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">
          Upload & Multimodal Analysis
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload textbook pages, handwritten notes, whiteboard diagrams, or slides to extract structured knowledge.
        </p>
      </div>

      {/* Drag & Drop Zone (WEB-004) */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-8 text-center cursor-pointer bg-white transition hover:bg-slate-50 flex flex-col items-center justify-center space-y-3"
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
        />
        <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <UploadCloud className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700">
            {file ? file.name : "Click to upload or drag and drop an image"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Supported: PNG, JPEG, WEBP (Max 10MB)
          </p>
        </div>
      </div>

      {file && !loading && !extracted && (
        <div className="flex justify-end">
          <button
            onClick={handleUpload}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition flex items-center gap-2"
          >
            <span>Analyze Image</span>
            <Sparkles className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Processing Status Indicator (WEB-004) */}
      {loading && job && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-xs space-y-2">
          <div className="flex items-center justify-between text-indigo-800 font-semibold">
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span>Analyzing image structure and text...</span>
            </span>
            <span className="capitalize">{job.status}</span>
          </div>
          <div className="w-full bg-indigo-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-indigo-600 h-full transition-all duration-300"
              style={{ width: `${Math.max(job.progress || 25, 20)}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Extracted Content Result (WEB-004) */}
      {extracted && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Extracted Context Ready</span>
              </div>
              <h2 className="text-lg font-bold text-slate-800">{extracted.title}</h2>
              <p className="text-xs text-slate-500">
                {extracted.subject} → {extracted.topic}
              </p>
            </div>

            {/* Quick Actions for Reusable Context */}
            <div className="flex items-center gap-2">
              <Link
                href={`/summaries?source_id=${extracted.id}`}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Summarize</span>
              </Link>
              <Link
                href={`/quizzes?source_id=${extracted.id}`}
                className="px-3 py-1.5 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
              >
                <Award className="w-3.5 h-3.5" />
                <span>Quiz</span>
              </Link>
            </div>
          </div>

          {/* Uncertainty Warnings */}
          {extracted.uncertainties && extracted.uncertainties.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              <span className="font-semibold">⚠️ Attention:</span> {extracted.uncertainties.join("; ")}
            </div>
          )}

          {/* Extracted Text */}
          <div>
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Extracted Notes / Content
            </h3>
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
              {extracted.extracted_text}
            </div>
          </div>

          {/* Key Concepts & Equations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {extracted.key_concepts && extracted.key_concepts.length > 0 && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Key Concepts
                </h4>
                <ul className="list-disc list-inside text-xs text-slate-700 space-y-1">
                  {extracted.key_concepts.map((kc, i) => (
                    <li key={i}>{kc}</li>
                  ))}
                </ul>
              </div>
            )}

            {extracted.equations && extracted.equations.length > 0 && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Formulas & Equations
                </h4>
                <ul className="list-disc list-inside text-xs text-slate-700 space-y-1 font-mono">
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


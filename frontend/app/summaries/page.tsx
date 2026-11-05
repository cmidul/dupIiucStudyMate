"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  Copy,
  Check,
  RotateCw,
  Sparkles,
  BookOpen,
  HelpCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  Download,
  Printer,
} from "lucide-react";
import Link from "next/link";
import { api, Summary } from "@/lib/api";
import { MathBlock, FormattedTextWithMath } from "@/components/MathRenderer";

function SummariesComponent() {
  const searchParams = useSearchParams();
  const sourceContentId = searchParams.get("source_id") || undefined;
  const conversationId = searchParams.get("conv_id") || undefined;

  const [textInput, setTextInput] = useState("");
  const [style, setStyle] = useState<"short" | "detailed" | "exam_notes">("detailed");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (sourceContentId || conversationId) {
      handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceContentId, conversationId]);

  const handleGenerate = async () => {
    if (!textInput.trim() && !sourceContentId && !conversationId) {
      setErrorMsg("Please enter source material or provide an excerpt to summarize.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.generateSummary({
        source_text: textInput.trim() || undefined,
        source_content_id: sourceContentId,
        conversation_id: conversationId,
        style,
      });
      setSummary(res);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || "Failed to generate academic summary.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!summary) return;
    const textToCopy = `
# ${summary.title} (${summary.style})
${summary.overview}

## Key Points:
${summary.content.key_points.map((p) => `• ${p}`).join("\n")}

## Definitions:
${summary.content.important_definitions.map((d) => `• ${d}`).join("\n")}

## Formulas:
${summary.content.formulas.map((f) => `• ${f}`).join("\n")}

## Examples:
${summary.content.examples.map((e) => `• ${e}`).join("\n")}
    `.trim();

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportMarkdown = () => {
    if (!summary) return;
    const textToExport = `
# ${summary.title} (${summary.style})
*Topic: ${summary.topic}*

## Executive Overview
${summary.overview}

## Key Analytical Takeaways
${summary.content.key_points.map((p) => `- ${p}`).join("\n")}

## Canonical Definitions
${summary.content.important_definitions.map((d) => `- ${d}`).join("\n")}

## Mathematical Expressions & Theorems
${summary.content.formulas.map((f) => `- ${f}`).join("\n")}

## Illustrative Examples
${summary.content.examples.map((e) => `- ${e}`).join("\n")}
    `.trim();

    const blob = new Blob([textToExport], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeTitle = (summary.title || "summary").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    link.href = url;
    link.download = `summary-${safeTitle}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8 w-full">
      {/* Header */}
      <div className="page-heading flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-midnight-700 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 dark:text-slate-100 mt-1">
            Summaries
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Turn a passage, lecture, or image into notes for revision.
          </p>
        </div>

        <Link
          href="/solve"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-midnight-800 hover:bg-slate-200 dark:hover:bg-midnight-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-mono transition self-start sm:self-auto"
        >
          <span>Use Unified Solve</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Input Controls */}
      <div className="workspace-panel p-6 md:p-8 space-y-6">
        {/* Style Selector */}
        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 font-semibold mb-2">
            Target Synthesis Depth
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["short", "detailed", "exam_notes"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStyle(s)}
                className={`py-2 px-3 text-xs font-mono rounded-lg border transition capitalize ${
                  style === s
                    ? "bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900 font-semibold"
                    : "bg-slate-50 dark:bg-midnight-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Text Area */}
        {!sourceContentId && !conversationId && (
          <div>
            <label htmlFor="source-text" className="block text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 font-semibold mb-2">
              Source Excerpt or Academic Passage
            </label>
            <textarea
              id="source-text"
              rows={5}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Paste research excerpt, lecture transcript, or study material here..."
              className="w-full p-4 text-xs md:text-sm bg-slate-50 dark:bg-midnight-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:bg-white dark:focus:bg-midnight-900 focus:outline-none focus:ring-1 focus:ring-scholar-emerald text-slate-900 dark:text-slate-100 placeholder:text-slate-400 leading-relaxed font-sans"
            />
          </div>
        )}

        {(sourceContentId || conversationId) && (
          <div className="p-3.5 bg-slate-50 dark:bg-midnight-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-scholar-emerald" />
            <span>Connected to {sourceContentId ? "Extracted Manuscript Content" : "Academic Dialogue History"}.</span>
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-6 py-2.5 bg-slate-900 dark:bg-scholar-emerald hover:bg-slate-800 dark:hover:bg-emerald-600 disabled:opacity-40 text-white dark:text-slate-950 text-xs font-semibold rounded-xl transition flex items-center gap-2 shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating Synthesis...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Summary</span>
              </>
            )}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Rendered Summary */}
      {summary && (
        <div className="bg-white dark:bg-midnight-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
          {/* Header & Copy Button */}
          <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-5">
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 dark:bg-midnight-800 text-scholar-emerald uppercase tracking-wider mb-2">
                {summary.style.replace("_", " ")}
              </span>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900 dark:text-slate-100">
                {summary.title}
              </h2>
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1">Topic: {summary.topic}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="p-2 border border-slate-200 dark:border-midnight-700 bg-slate-50 dark:bg-midnight-800 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-midnight-700 transition flex items-center gap-1.5 text-xs font-mono"
                aria-label="Copy summary to clipboard"
                title="Copy summary"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-scholar-emerald" />
                    <span className="text-scholar-emerald">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleExportMarkdown}
                className="p-2 border border-slate-200 dark:border-midnight-700 bg-slate-50 dark:bg-midnight-800 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-midnight-700 transition flex items-center gap-1.5 text-xs font-mono"
                aria-label="Export summary as Markdown"
                title="Export .md file"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>Export .md</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="p-2 border border-slate-200 dark:border-midnight-700 bg-slate-50 dark:bg-midnight-800 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-midnight-700 transition flex items-center gap-1.5 text-xs font-mono"
                aria-label="Print or save as PDF"
                title="Print / PDF"
              >
                <Printer className="w-3.5 h-3.5 text-slate-400" />
                <span>Print / PDF</span>
              </button>
            </div>
          </div>

          {/* Overview */}
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-2">
              Executive Overview
            </h3>
            <div className="text-xs md:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
              <FormattedTextWithMath text={summary.overview} />
            </div>
          </div>

          {/* Key Points */}
          {summary.content.key_points && summary.content.key_points.length > 0 && (
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-2">
                Key Analytical Takeaways
              </h3>
              <ul className="list-disc list-inside text-xs md:text-sm text-slate-700 dark:text-slate-300 space-y-1.5">
                {summary.content.key_points.map((pt, idx) => (
                  <li key={idx}>{pt}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Definitions */}
          {summary.content.important_definitions && summary.content.important_definitions.length > 0 && (
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-2">
                Canonical Definitions
              </h3>
              <ul className="space-y-2">
                {summary.content.important_definitions.map((def, idx) => (
                  <li key={idx} className="p-3 bg-slate-50 dark:bg-midnight-950 rounded-xl text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                    {def}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Formulas */}
          {summary.content.formulas && summary.content.formulas.length > 0 && (
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-2">
                Mathematical Expressions & Theorems
              </h3>
              <div className="p-3.5 bg-slate-50 dark:bg-midnight-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                {summary.content.formulas.map((f, idx) => (
                  <MathBlock key={idx} content={f} block={true} className="text-scholar-emerald" />
                ))}
              </div>
            </div>
          )}

          {/* Examples */}
          {summary.content.examples && summary.content.examples.length > 0 && (
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-2">
                Exemplar Case Studies
              </h3>
              <ul className="list-disc list-inside text-xs md:text-sm text-slate-700 dark:text-slate-300 space-y-1">
                {summary.content.examples.map((ex, idx) => (
                  <li key={idx}>{ex}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SummariesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-8 text-slate-400 text-xs font-mono">
          Loading Synthesis Engine...
        </div>
      }
    >
      <SummariesComponent />
    </Suspense>
  );
}

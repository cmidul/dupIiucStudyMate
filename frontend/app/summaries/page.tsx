"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  Copy,
  Check,
  Sparkles,
  BookOpen,
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#2E333D] pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#E8EAF0] tracking-tight">
            Study Notes & Summaries
          </h1>
          <p className="text-xs sm:text-sm text-[#A0A6B4] mt-0.5">
            Transform lectures, textbook chapters, and passages into structured notes.
          </p>
        </div>

        <Link
          href="/solve"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1C1F26] hover:bg-[#242832] border border-[#2E333D] text-[#A0A6B4] hover:text-[#E8EAF0] rounded-xl text-xs font-mono transition self-start sm:self-auto"
        >
          <span>Solve Questions</span>
          <ArrowRight className="w-3.5 h-3.5 text-[#3B6CFF]" />
        </Link>
      </div>

      {/* Input Controls */}
      <div className="bg-[#1C1F26] border border-[#2E333D] rounded-2xl p-6 md:p-8 space-y-6 shadow-xl">
        {/* Style Selector */}
        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-[#3B6CFF] font-semibold mb-2">
            Target Synthesis Style
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["short", "detailed", "exam_notes"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStyle(s)}
                className={`py-2 px-3 text-xs font-mono rounded-xl border transition capitalize ${
                  style === s
                    ? "bg-[#3B6CFF] border-[#3B6CFF] text-white shadow-[0_0_10px_rgba(59,108,255,0.3)] font-semibold"
                    : "bg-[#14161A] border-[#2E333D] text-[#A0A6B4] hover:border-[#3B6CFF]/40 hover:text-[#E8EAF0]"
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
            <label
              htmlFor="source-text"
              className="block text-xs font-mono uppercase tracking-wider text-[#A0A6B4] font-semibold mb-2"
            >
              Source Passage or Excerpt
            </label>
            <textarea
              id="source-text"
              rows={6}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Paste research excerpt, lecture transcript, or study material here..."
              className="w-full p-4 text-xs md:text-sm bg-[#14161A] border border-[#2E333D] rounded-xl focus:border-[#3B6CFF] outline-none text-[#E8EAF0] placeholder:text-[#6B7280] leading-relaxed font-sans"
            />
          </div>
        )}

        {(sourceContentId || conversationId) && (
          <div className="p-3.5 bg-[#14161A] border border-[#2E333D] rounded-xl text-xs text-[#A0A6B4] flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#3B6CFF]" />
            <span>
              Connected to {sourceContentId ? "Extracted Manuscript Content" : "Academic Dialogue History"}.
            </span>
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-6 py-2.5 bg-[#3B6CFF] hover:bg-[#5A82FF] active:bg-[#2A55D9] disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition flex items-center gap-2 shadow-[0_0_15px_rgba(59,108,255,0.35)]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating Summary...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Notes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-[#FF5C6C]/10 border border-[#FF5C6C]/30 text-[#FF5C6C] rounded-2xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Rendered Summary */}
      {summary && (
        <div className="bg-[#1C1F26] border border-[#2E333D] rounded-2xl p-6 md:p-8 space-y-6 shadow-xl">
          {/* Header & Copy Button */}
          <div className="flex items-start justify-between border-b border-[#262A33] pb-5">
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#3B6CFF]/15 text-[#3B6CFF] border border-[#3B6CFF]/30 uppercase tracking-wider mb-2">
                {summary.style.replace("_", " ")}
              </span>
              <h2 className="text-xl md:text-2xl font-bold text-[#E8EAF0]">
                {summary.title}
              </h2>
              <p className="text-xs font-mono text-[#A0A6B4] mt-1">
                Topic: {summary.topic}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="p-2 border border-[#2E333D] bg-[#14161A] hover:bg-[#242832] rounded-xl text-[#A0A6B4] hover:text-[#E8EAF0] transition flex items-center gap-1.5 text-xs font-mono"
                title="Copy summary"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#3DDC97]" />
                    <span className="text-[#3DDC97]">Copied</span>
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
                className="p-2 border border-[#2E333D] bg-[#14161A] hover:bg-[#242832] rounded-xl text-[#A0A6B4] hover:text-[#E8EAF0] transition flex items-center gap-1.5 text-xs font-mono"
                title="Export .md file"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export .md</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="p-2 border border-[#2E333D] bg-[#14161A] hover:bg-[#242832] rounded-xl text-[#A0A6B4] hover:text-[#E8EAF0] transition flex items-center gap-1.5 text-xs font-mono"
                title="Print / PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* Overview */}
          <div className="space-y-2">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#3B6CFF] font-semibold">
              Executive Overview
            </h3>
            <div className="text-xs sm:text-sm text-[#E8EAF0] leading-relaxed p-4 rounded-xl bg-[#14161A] border border-[#2E333D]">
              <FormattedTextWithMath text={summary.overview} />
            </div>
          </div>

          {/* Key Points */}
          {summary.content.key_points && summary.content.key_points.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#3B6CFF] font-semibold">
                Key Analytical Takeaways
              </h3>
              <ul className="list-disc list-inside text-xs sm:text-sm text-[#E8EAF0] space-y-1.5 p-4 rounded-xl bg-[#14161A] border border-[#2E333D]">
                {summary.content.key_points.map((pt, idx) => (
                  <li key={idx} className="leading-relaxed">{pt}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Definitions */}
          {summary.content.important_definitions && summary.content.important_definitions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#3B6CFF] font-semibold">
                Important Definitions
              </h3>
              <ul className="space-y-2">
                {summary.content.important_definitions.map((def, idx) => (
                  <li
                    key={idx}
                    className="p-3 bg-[#14161A] rounded-xl text-xs text-[#E8EAF0] border border-[#2E333D]"
                  >
                    {def}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Formulas */}
          {summary.content.formulas && summary.content.formulas.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#3B6CFF] font-semibold">
                Mathematical Expressions & Theorems
              </h3>
              <div className="p-3.5 bg-[#14161A] rounded-xl border border-[#2E333D] space-y-2">
                {summary.content.formulas.map((f, idx) => (
                  <MathBlock key={idx} content={f} block={true} />
                ))}
              </div>
            </div>
          )}

          {/* Examples */}
          {summary.content.examples && summary.content.examples.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#3B6CFF] font-semibold">
                Examples
              </h3>
              <ul className="list-disc list-inside text-xs sm:text-sm text-[#A0A6B4] space-y-1 p-4 rounded-xl bg-[#14161A] border border-[#2E333D]">
                {summary.content.examples.map((ex, idx) => (
                  <li key={idx} className="leading-relaxed text-[#E8EAF0]">{ex}</li>
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
        <div className="flex-1 flex items-center justify-center p-8 text-[#A0A6B4] text-xs font-mono">
          Loading Synthesis Engine...
        </div>
      }
    >
      <SummariesComponent />
    </Suspense>
  );
}

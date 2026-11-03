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
} from "lucide-react";
import { api, Summary } from "@/lib/api";

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

  // Auto-generate if came from upload or conversation
  useEffect(() => {
    if (sourceContentId || conversationId) {
      handleGenerate();
    }
  }, [sourceContentId, conversationId]);

  const handleGenerate = async () => {
    if (!textInput.trim() && !sourceContentId && !conversationId) {
      setErrorMsg("Please enter text or provide source material.");
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
      setErrorMsg(error.message || "Failed to generate summary.");
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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">
          Summary Workspace
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Generate structured learning summaries tailored to your study goals: concise overviews, detailed notes, or exam sheets.
        </p>
      </div>

      {/* Input Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        {/* Style Selector (WEB-005) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Summary Style
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["short", "detailed", "exam_notes"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStyle(s)}
                className={`py-2 px-3 text-xs font-semibold rounded-xl border transition capitalize ${
                  style === s
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
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
            <label htmlFor="source-text" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Source Material / Notes
            </label>
            <textarea
              id="source-text"
              rows={4}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Paste article, lecture notes, textbook excerpt, or topic..."
              className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

        {(sourceContentId || conversationId) && (
          <div className="p-3 bg-indigo-50 rounded-xl text-xs text-indigo-800 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span>Summarizing connected material ({sourceContentId ? "Extracted Image" : "Chat Session"}).</span>
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition flex items-center gap-2 shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating Summary...</span>
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
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Rendered Summary (WEB-005) */}
      {summary && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
          {/* Header & Copy Button */}
          <div className="flex items-start justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600 capitalize mb-1">
                {summary.style.replace("_", " ")}
              </span>
              <h2 className="text-xl font-bold text-slate-800">{summary.title}</h2>
              <p className="text-xs text-slate-400 mt-0.5">Topic: {summary.topic}</p>
            </div>
            <button
              onClick={handleCopy}
              className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition flex items-center gap-1.5 text-xs font-medium"
              aria-label="Copy summary to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {/* Overview */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Overview</h3>
            <p className="text-sm text-slate-800 leading-relaxed">{summary.overview}</p>
          </div>

          {/* Key Points */}
          {summary.content.key_points && summary.content.key_points.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Key Takeaways</h3>
              <ul className="list-disc list-inside text-sm text-slate-700 space-y-1.5">
                {summary.content.key_points.map((pt, idx) => (
                  <li key={idx}>{pt}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Definitions */}
          {summary.content.important_definitions && summary.content.important_definitions.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Important Definitions</h3>
              <ul className="space-y-2">
                {summary.content.important_definitions.map((def, idx) => (
                  <li key={idx} className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-100">
                    {def}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Formulas */}
          {summary.content.formulas && summary.content.formulas.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Formulas</h3>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 font-mono text-xs text-indigo-700 space-y-1">
                {summary.content.formulas.map((f, idx) => (
                  <div key={idx}>{f}</div>
                ))}
              </div>
            </div>
          )}

          {/* Examples */}
          {summary.content.examples && summary.content.examples.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Illustrative Examples</h3>
              <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
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
        <div className="flex-1 flex items-center justify-center p-8 text-slate-400 text-sm">
          Loading Summaries...
        </div>
      }
    >
      <SummariesComponent />
    </Suspense>
  );
}


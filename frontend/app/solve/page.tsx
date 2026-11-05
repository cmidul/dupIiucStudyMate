"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Calculator,
  Binary,
  BookOpen,
  HelpCircle,
  Sparkles,
  Loader2,
  Upload,
  Image as ImageIcon,
  X,
  Send,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  RefreshCw,
  FileCode,
  Table,
  Check,
  Download,
  Printer,
  Copy,
} from "lucide-react";
import {
  api,
  UnifiedSolveResponse,
  TaskType,
  UnifiedFollowUpResponse,
} from "@/lib/api";
import { MathBlock, FormattedTextWithMath } from "@/components/MathRenderer";
import SolutionText from "@/components/SolutionText";

interface FollowUpMessage {
  role: "user" | "assistant";
  content: string;
}

function SolveWorkspaceContent() {
  const searchParams = useSearchParams();

  // Composer state
  const [inputText, setInputText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [preferredStyle, setPreferredStyle] = useState<"exam_notes" | "detailed" | "short">("exam_notes");
  const [domain, setDomain] = useState<"real" | "complex">("real");

  // Execution state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [solution, setSolution] = useState<UnifiedSolveResponse | null>(null);

  // Mobile active panel toggle
  const [mobileTab, setMobileTab] = useState<"composer" | "solution">("composer");

  // Follow-up state
  const [followUpInput, setFollowUpInput] = useState("");
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpThread, setFollowUpThread] = useState<FollowUpMessage[]>([]);
  const [copiedSolution, setCopiedSolution] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const answerHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (solution) answerHeadingRef.current?.focus();
  }, [solution]);

  const generateSolutionMarkdown = () => {
    if (!solution) return "";
    let md = `# ${solution.title}\n\n`;
    md += `**Task:** ${solution.task_label} (${solution.task_type})\n\n`;
    md += `## Conclusion / Answer\n\n${solution.summary_or_answer}\n\n`;

    if (solution.task_type === "mathematics" && solution.math_solution?.steps) {
      md += `## Mathematical Derivation\n\n`;
      solution.math_solution.steps.forEach((st: any, idx: number) => {
        md += `### Step ${st.step || idx + 1}: ${st.explanation}\n`;
        if (st.expression) {
          md += `$$\n${st.expression}\n$$\n\n`;
        }
      });
    }

    if (solution.task_type === "logical_reasoning" && solution.logic_solution?.reasoning_steps) {
      md += `## Formal Logical Reasoning\n\n`;
      solution.logic_solution.reasoning_steps.forEach((st: string) => {
        md += `- ${st}\n`;
      });
    }

    if (solution.task_type === "general_educational" && solution.educational_solution?.steps) {
      md += `## Pedagogical Explanation\n\n`;
      solution.educational_solution.steps.forEach((st: any) => {
        md += `### ${st.step}. ${st.title}\n${st.explanation}\n\n`;
      });
    }

    return md;
  };

  const handleCopySolution = () => {
    const md = generateSolutionMarkdown();
    if (!md) return;
    navigator.clipboard.writeText(md);
    setCopiedSolution(true);
    setTimeout(() => setCopiedSolution(false), 2000);
  };

  const handleExportMarkdown = () => {
    const md = generateSolutionMarkdown();
    if (!md) return;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeTitle = (solution?.title || "solution").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    link.href = url;
    link.download = `${safeTitle}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  // Pre-fill from query string if available
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      setInputText(q);
    }
  }, [searchParams]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
      setFilePreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClearAll = () => {
    setInputText("");
    handleClearFile();
    setErrorMsg(null);
  };

  const handleSolve = async () => {
    if (!inputText.trim() && !selectedFile) {
      setErrorMsg("Please provide a question, problem equation, or select an educational image.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSolution(null);
    setFollowUpThread([]);

    try {
      let res: UnifiedSolveResponse;
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        if (inputText.trim()) {
          formData.append("input_text", inputText.trim());
        }
        formData.append("preferred_style", preferredStyle);
        res = await api.uploadAndSolveQuestion(formData);
      } else {
        res = await api.solveQuestion({
          input_text: inputText.trim(),
          preferred_style: preferredStyle,
          domain,
        });
      }
      setSolution(res);
      setMobileTab("solution");
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || "Failed to solve problem. Please check the input syntax.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendFollowUp = async () => {
    if (!followUpInput.trim() || !solution?.conversation_id) return;

    const userMsg = followUpInput.trim();
    setFollowUpInput("");
    setFollowUpLoading(true);

    setFollowUpThread((prev) => [...prev, { role: "user", content: userMsg }]);

    try {
      const res: UnifiedFollowUpResponse = await api.askSolveFollowUp({
        conversation_id: solution.conversation_id,
        message: userMsg,
        source_content_id: solution.source_content_id,
      });

      setFollowUpThread((prev) => [
        ...prev,
        { role: "assistant", content: res.assistant_message },
      ]);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setFollowUpThread((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Unable to process follow-up: ${error.message || "Error reaching solver service."}`,
        },
      ]);
    } finally {
      setFollowUpLoading(false);
    }
  };

  const getTaskInfo = (taskType: TaskType) => {
    switch (taskType) {
      case "mathematics":
        return {
          icon: Calculator,
          label: "Mathematics",
          badgeClass: "bg-blue-950/70 text-blue-300 border-blue-800/80",
        };
      case "logical_reasoning":
        return {
          icon: Binary,
          label: "Logical Reasoning",
          badgeClass: "bg-purple-950/70 text-purple-300 border-purple-800/80",
        };
      case "summarization":
        return {
          icon: BookOpen,
          label: "Study Summary",
          badgeClass: "bg-emerald-950/70 text-emerald-300 border-emerald-800/80",
        };
      case "general_educational":
      default:
        return {
          icon: Lightbulb,
          label: "Explanation",
          badgeClass: "bg-amber-950/70 text-amber-300 border-amber-800/80",
        };
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6 text-slate-800 dark:text-slate-200">
      {/* Workspace Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-midnight-700 pb-4">
        <div className="page-heading">
          <h1 className="font-serif text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mt-0.5">
            Solve Questions
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Type a question or upload a photo to get an answer and worked steps.
          </p>
        </div>

        {/* Mobile View Switcher */}
        <div className="flex lg:hidden rounded-lg border border-slate-200 dark:border-midnight-700 bg-white dark:bg-midnight-850 p-1 text-sm">
          <button
            onClick={() => setMobileTab("composer")}
            aria-pressed={mobileTab === "composer"}
            className={`px-3 py-1 rounded font-medium transition ${
              mobileTab === "composer" ? "bg-white dark:bg-midnight-750 text-scholar-emerald shadow-sm font-semibold" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            Question
          </button>
          <button
            onClick={() => setMobileTab("solution")}
            aria-pressed={mobileTab === "solution"}
            className={`px-3 py-1 rounded font-medium transition ${
              mobileTab === "solution" ? "bg-white dark:bg-midnight-750 text-scholar-emerald shadow-sm font-semibold" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            Answer
          </button>
        </div>
      </div>

      {/* Split Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(17rem,0.65fr)_minmax(0,1.35fr)] gap-5 items-start">
        {/* ================= LEFT PANEL: COMPOSER ================= */}
        <div
          className={`min-w-0 space-y-4 ${
            mobileTab === "solution" ? "hidden lg:block" : "block"
          }`}
        >
          <div className="workspace-panel p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Your question</h2>
              {(inputText || selectedFile) && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[11px] font-mono text-slate-400 hover:text-red-500 transition"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Question Textarea */}
            <div>
              <label htmlFor="problem-textarea" className="sr-only">
                Enter your question, mathematical expression, or passage
              </label>
              <textarea
                id="problem-textarea"
                rows={5}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="For example, why does increasing the clock rate reduce execution time?"
                className="w-full p-3.5 bg-slate-50 dark:bg-midnight-950 border border-slate-200 dark:border-midnight-700 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-scholar-emerald focus:ring-1 focus:ring-scholar-emerald leading-relaxed resize-y"
              />
            </div>

            {/* Attached Image Preview */}
            {selectedFile && (
              <div className="relative border border-slate-200 dark:border-midnight-700 rounded-lg p-2.5 bg-slate-50 dark:bg-midnight-950 flex items-center justify-between">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  {filePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={filePreview}
                      alt="Source preview"
                      className="w-10 h-10 object-cover rounded border border-slate-200 dark:border-midnight-700"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-slate-200 dark:bg-midnight-800 flex items-center justify-center">
                      <ImageIcon className="w-4 h-4 text-slate-400" />
                    </div>
                  )}
                  <div className="overflow-hidden leading-tight">
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate block">
                      {selectedFile.name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 block">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Image source
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearFile}
                  className="p-1 rounded text-slate-400 hover:text-red-500 transition"
                  aria-label="Remove attached image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Upload Controls & Preferences */}
            <div className="pt-2 border-t border-slate-200 dark:border-midnight-700 flex flex-wrap items-center justify-between gap-3">
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-midnight-700 bg-slate-50 dark:bg-midnight-800 hover:bg-slate-100 dark:hover:bg-midnight-700 text-xs font-medium text-slate-700 dark:text-slate-300 transition"
                >
                  <Upload className="w-3.5 h-3.5 text-scholar-emerald" />
                  <span>Upload a photo</span>
                </button>
              </div>

              {/* Advanced Context Options (collapsed/minimal) */}
              <div className="flex items-center gap-2 text-xs">
                <select
                  value={preferredStyle}
                  onChange={(e) => setPreferredStyle(e.target.value as any)}
                  aria-label="Summary style preference"
                  className="bg-slate-50 dark:bg-midnight-800 border border-slate-200 dark:border-midnight-700 rounded px-2 py-1 text-[11px] font-mono text-slate-700 dark:text-slate-300 focus:outline-none"
                  title="Preferred summary depth if passage is detected"
                >
                  <option value="exam_notes">Exam Notes</option>
                  <option value="detailed">Detailed</option>
                  <option value="short">Concise</option>
                </select>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div role="alert" className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 text-red-700 dark:text-red-300 rounded-lg text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {/* Submit Action */}
            <button
              type="button"
              onClick={handleSolve}
              disabled={loading}
              className="w-full min-h-11 py-2.5 px-4 bg-scholar-emerald disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Working on it…</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Solve question</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ================= RIGHT PANEL: AI ANSWER & EXPLANATION ================= */}
        <div
          aria-busy={loading}
          className={`min-w-0 space-y-5 ${
            mobileTab === "composer" ? "hidden lg:block" : "block"
          }`}
        >
          {loading ? (
            /* Contextual Loading State */
            <div role="status" className="workspace-panel p-8 text-center space-y-4">
              <Loader2 className="w-7 h-7 text-scholar-emerald animate-spin mx-auto" />
              <div>
                <div className="text-sm font-serif font-semibold text-slate-900 dark:text-slate-200">
                  {selectedFile ? "Reading your photo" : "Working on your answer"}
                </div>
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1">
                  {selectedFile ? "We’ll read the text, then work through the questions." : "Your answer and worked steps will appear here."}
                </p>
              </div>
            </div>
          ) : !solution ? (
            /* Empty State */
            <div className="workspace-panel p-8 sm:p-12 text-center space-y-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-midnight-800 border border-slate-200 dark:border-midnight-700 flex items-center justify-center text-slate-400 mx-auto">
                <Calculator className="w-5 h-5 text-scholar-emerald" />
              </div>
              <h2 className="text-sm font-serif font-semibold text-slate-900 dark:text-slate-200">
                Your answer will appear here
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                Start with a written question or a clear photo of the problem.
              </p>
            </div>
          ) : solution.clarification_needed ? (
            <div className="workspace-panel p-5 space-y-3" role="status">
              <h2 ref={answerHeadingRef} tabIndex={-1} className="flex items-center gap-2 font-semibold">
                <HelpCircle className="w-5 h-5 text-amber-500" />
                A detail is missing
              </h2>
              <p className="leading-relaxed">{solution.clarification_question || solution.summary_or_answer}</p>
              <button type="button" onClick={() => setMobileTab("composer")} className="lg:hidden text-sm font-semibold text-scholar-emerald">
                Edit question
              </button>
            </div>
          ) : (
            <div className="space-y-5">

              {/* Main Solution Card */}
              <div className="workspace-panel p-4 sm:p-6 space-y-6">
                <section aria-labelledby="answer-heading" className="answer-panel p-4 sm:p-6">
                  <h2 id="answer-heading" ref={answerHeadingRef} tabIndex={-1} className="text-xl font-semibold tracking-tight mb-3">
                    {solution.task_type === "summarization" ? "Summary" : "Answer"}
                  </h2>
                  <SolutionText text={solution.summary_or_answer} />
                </section>
                {/* Header: Task Badge & Title */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-midnight-700 pb-4">
                  <div>
                    {(() => {
                      const task = getTaskInfo(solution.task_type);
                      const Icon = task.icon;
                      return (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono border ${task.badgeClass}`}
                        >
                          <Icon className="w-3 h-3" />
                          <span>{task.label}</span>
                        </span>
                      );
                    })()}
                    {solution.math_solution?.verification?.status === "passed" && (
                      <span className="ml-2 inline-flex items-center gap-1.5 text-xs font-medium text-scholar-emerald">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Checked with SymPy
                      </span>
                    )}
                  </div>

                  {/* Actions & Verification Bar */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Copy Solution Button */}
                    <button
                      type="button"
                      onClick={handleCopySolution}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-50 dark:bg-midnight-800 hover:bg-slate-100 dark:hover:bg-midnight-700 border border-slate-200 dark:border-midnight-700 text-[11px] font-mono text-slate-700 dark:text-slate-300 transition"
                      title="Copy full solution as Markdown"
                    >
                      {copiedSolution ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-scholar-emerald" />
                          <span className="text-scholar-emerald">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    {/* Export Markdown Button */}
                    <button
                      type="button"
                      onClick={handleExportMarkdown}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-50 dark:bg-midnight-800 hover:bg-slate-100 dark:hover:bg-midnight-700 border border-slate-200 dark:border-midnight-700 text-[11px] font-mono text-slate-700 dark:text-slate-300 transition"
                      title="Export solution as .md file"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-400" />
                      <span>Export .md</span>
                    </button>

                    {/* Print / PDF Button */}
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-50 dark:bg-midnight-800 hover:bg-slate-100 dark:hover:bg-midnight-700 border border-slate-200 dark:border-midnight-700 text-[11px] font-mono text-slate-700 dark:text-slate-300 transition"
                      title="Print or save as PDF"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-400" />
                      <span>Print / PDF</span>
                    </button>

                  </div>
                </div>

                {/* Task-Specific Renderings */}
                {/* 1. Mathematics Steps */}
                {solution.task_type === "mathematics" && solution.math_solution && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold">
                      Worked steps
                    </h3>
                    <div className="space-y-2">
                      {solution.math_solution.steps?.map((step: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg border border-slate-200 dark:border-midnight-700 bg-slate-50 dark:bg-midnight-800 space-y-1.5"
                        >
                          <div className="flex items-start gap-2 text-xs font-medium text-slate-800 dark:text-slate-200">
                            <span className="w-4 h-4 rounded bg-slate-200 dark:bg-midnight-950 border border-slate-300 dark:border-midnight-700 flex items-center justify-center font-mono text-[10px] text-scholar-emerald flex-shrink-0 mt-0.5">
                              {step.step || idx + 1}
                            </span>
                            <FormattedTextWithMath text={step.explanation} className="leading-relaxed" />
                          </div>
                          {step.expression && (
                            <div className="pl-6 py-1">
                              <MathBlock
                                content={step.expression}
                                block={true}
                                className="text-slate-900 dark:text-slate-100 bg-white dark:bg-midnight-950 p-3 rounded border border-slate-200 dark:border-midnight-700 shadow-xs"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Logical Reasoning */}
                {solution.task_type === "logical_reasoning" && solution.logic_solution && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Formal Reasoning & Truth Table
                    </h3>
                    <div className="space-y-1.5">
                      {solution.logic_solution.reasoning_steps?.map((step: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                          <ArrowRight className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{step}</span>
                        </div>
                      ))}
                    </div>

                    {/* Truth Table */}
                    {solution.logic_solution.truth_table && (
                      <div className="mt-3 border border-slate-200 dark:border-midnight-700 rounded-lg overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 dark:bg-midnight-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-midnight-700">
                            <tr>
                              {solution.logic_solution.truth_table.variables?.map((v: string) => (
                                <th key={v} className="p-2 font-mono">{v}</th>
                              ))}
                              <th className="p-2 font-mono text-scholar-emerald">Result</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-midnight-700">
                            {solution.logic_solution.truth_table.rows?.map((row: any, rIdx: number) => (
                              <tr key={rIdx} className="hover:bg-slate-100 dark:hover:bg-midnight-800">
                                {solution.logic_solution.truth_table.variables?.map((v: string) => (
                                  <td key={v} className="p-2 font-mono text-slate-700 dark:text-slate-300">
                                    {row.assignment[v] ? "T" : "F"}
                                  </td>
                                ))}
                                <td className="p-2 font-mono font-bold text-scholar-emerald">
                                  {row.result ? "T" : "F"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Summarization */}
                {solution.task_type === "summarization" && solution.summary_solution && (
                  <div className="space-y-4">
                    {solution.summary_solution.content?.sections?.map((sec: any, idx: number) => (
                      <div key={idx} className="space-y-1.5">
                        <h4 className="text-xs font-mono uppercase tracking-wider text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-scholar-emerald"></span>
                          <span>{sec.heading}</span>
                        </h4>
                        <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                          {sec.points?.map((pt: string, pIdx: number) => (
                            <li key={pIdx} className="leading-relaxed">{pt}</li>
                          ))}
                        </ul>
                      </div>
                    ))}

                    {/* Key Terms */}
                    {solution.summary_solution.content?.key_terms?.length > 0 && (
                      <div className="pt-2 border-t border-slate-200 dark:border-midnight-700">
                        <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                          Key Definitions & Nomenclature
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {solution.summary_solution.content.key_terms.map((kt: any, idx: number) => (
                            <div key={idx} className="p-2.5 rounded border border-slate-200 dark:border-midnight-700 bg-slate-50 dark:bg-midnight-950 text-xs">
                              <span className="font-semibold text-slate-900 dark:text-slate-200">{kt.term}: </span>
                              <span className="text-slate-600 dark:text-slate-400">{kt.definition}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Pedagogical QA */}
                {solution.task_type === "general_educational" && solution.educational_solution && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">
                      How to get there
                    </h3>
                    <div className="space-y-2.5">
                      {solution.educational_solution.steps?.map((st, idx) => (
                        <div key={idx} className="p-3 rounded-lg border border-slate-200 dark:border-midnight-700 bg-slate-50 dark:bg-midnight-800 space-y-1">
                          <div className="text-sm font-semibold text-scholar-emerald">
                            {st.step}. {st.title}
                          </div>
                          <SolutionText text={st.explanation} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Conversational Follow-Up Thread */}
              <div className="workspace-panel p-5 space-y-4">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <RefreshCw className="w-3.5 h-3.5 text-scholar-emerald" />
                  <span>Ask a follow-up</span>
                </h2>

                {followUpThread.length > 0 && (
                  <div className="space-y-2.5 pt-1">
                    {followUpThread.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg text-xs leading-relaxed ${
                          msg.role === "user"
                            ? "bg-slate-100 dark:bg-midnight-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-midnight-700 ml-6"
                            : "bg-slate-50 dark:bg-midnight-950 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-midnight-700 mr-6"
                        }`}
                      >
                        <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                          {msg.role === "user" ? "Query" : "Explanation"}
                        </span>
                        <FormattedTextWithMath text={msg.content} className="whitespace-pre-wrap" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Follow-up input */}
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    aria-label="Follow-up question"
                    value={followUpInput}
                    onChange={(e) => setFollowUpInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendFollowUp();
                      }
                    }}
                    placeholder="Ask a clarifying follow-up question..."
                    className="min-w-0 flex-1 px-3 py-2 bg-slate-50 dark:bg-midnight-950 border border-slate-200 dark:border-midnight-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-scholar-emerald"
                  />
                  <button
                    type="button"
                    onClick={handleSendFollowUp}
                    disabled={followUpLoading || !followUpInput.trim()}
                    className="px-3.5 py-2 bg-slate-100 dark:bg-midnight-800 hover:bg-slate-200 dark:hover:bg-midnight-700 border border-slate-200 dark:border-midnight-700 text-xs font-medium text-slate-700 dark:text-slate-200 rounded-lg transition disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
                  >
                    {followUpLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5 text-scholar-emerald" />
                    )}
                    <span>Ask</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SolveWorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-8 text-slate-400 text-xs font-mono">
          Loading Unified Solve Workspace...
        </div>
      }
    >
      <SolveWorkspaceContent />
    </Suspense>
  );
}

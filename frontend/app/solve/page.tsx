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
} from "lucide-react";
import {
  api,
  UnifiedSolveResponse,
  TaskType,
  UnifiedFollowUpResponse,
} from "@/lib/api";

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

  const fileInputRef = useRef<HTMLInputElement>(null);

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
          label: "Pedagogical Explanation",
          badgeClass: "bg-amber-950/70 text-amber-300 border-amber-800/80",
        };
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6 text-slate-200">
      {/* Workspace Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1e293b] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono tracking-wider uppercase text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Split Workspace</span>
          </div>
          <h1 className="font-serif text-2xl font-bold text-slate-100 tracking-tight mt-0.5">
            Solve Questions
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Automatic task detection for mathematical proofs, formal syllogisms, passage notes, and educational QA.
          </p>
        </div>

        {/* Mobile View Switcher */}
        <div className="flex md:hidden rounded-lg border border-[#1e293b] bg-[#111827] p-1 text-xs">
          <button
            onClick={() => setMobileTab("composer")}
            className={`px-3 py-1 rounded font-medium transition ${
              mobileTab === "composer" ? "bg-[#17223b] text-emerald-400" : "text-slate-400"
            }`}
          >
            Composer
          </button>
          <button
            onClick={() => setMobileTab("solution")}
            className={`px-3 py-1 rounded font-medium transition ${
              mobileTab === "solution" ? "bg-[#17223b] text-emerald-400" : "text-slate-400"
            }`}
          >
            Solution {solution && "•"}
          </button>
        </div>
      </div>

      {/* Split Workspace Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* ================= LEFT PANEL: COMPOSER ================= */}
        <div
          className={`md:col-span-5 space-y-4 ${
            mobileTab === "solution" ? "hidden md:block" : "block"
          }`}
        >
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Input Composer
              </span>
              {(inputText || selectedFile) && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[11px] font-mono text-slate-400 hover:text-red-400 transition"
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
                rows={6}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type any question, algebraic equation, logical premise, or paste an educational passage...&#10;&#10;e.g. 'Solve x^2 - 5x + 6 = 0' or 'If all A are B and all B are C...'"
                className="w-full p-3.5 bg-[#0b0f19] border border-[#1e293b] rounded-lg text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 leading-relaxed resize-y"
              />
            </div>

            {/* Attached Image Preview */}
            {selectedFile && (
              <div className="relative border border-[#1e293b] rounded-lg p-2.5 bg-[#0b0f19] flex items-center justify-between">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  {filePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={filePreview}
                      alt="Source preview"
                      className="w-10 h-10 object-cover rounded border border-[#1e293b]"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-[#162032] flex items-center justify-center">
                      <ImageIcon className="w-4 h-4 text-slate-400" />
                    </div>
                  )}
                  <div className="overflow-hidden leading-tight">
                    <span className="text-xs font-medium text-slate-200 truncate block">
                      {selectedFile.name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 block">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Image source
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearFile}
                  className="p-1 rounded text-slate-500 hover:text-red-400 transition"
                  aria-label="Remove attached image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Upload Controls & Preferences */}
            <div className="pt-2 border-t border-[#1e293b] flex flex-wrap items-center justify-between gap-3">
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1e293b] bg-[#162032] hover:bg-[#1c2a47] text-xs font-medium text-slate-300 transition"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Attach Image</span>
                </button>
              </div>

              {/* Advanced Context Options (collapsed/minimal) */}
              <div className="flex items-center gap-2 text-xs">
                <select
                  value={preferredStyle}
                  onChange={(e) => setPreferredStyle(e.target.value as any)}
                  aria-label="Summary style preference"
                  className="bg-[#162032] border border-[#1e293b] rounded px-2 py-1 text-[11px] font-mono text-slate-300 focus:outline-none"
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
              <div className="p-3 bg-red-950/40 border border-red-800/80 text-red-300 rounded-lg text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {/* Submit Action */}
            <button
              type="button"
              onClick={handleSolve}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-semibold text-xs rounded-lg transition flex items-center justify-center gap-2 shadow-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Classifying & Solving...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Derive Solution</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ================= RIGHT PANEL: AI ANSWER & EXPLANATION ================= */}
        <div
          className={`md:col-span-7 space-y-6 ${
            mobileTab === "composer" ? "hidden md:block" : "block"
          }`}
        >
          {loading ? (
            /* Contextual Loading State */
            <div className="border border-[#1e293b] rounded-xl bg-[#111827] p-12 text-center space-y-4">
              <Loader2 className="w-7 h-7 text-emerald-400 animate-spin mx-auto" />
              <div>
                <div className="text-sm font-serif font-semibold text-slate-200">
                  Analyzing Question & Synthesizing Solution
                </div>
                <p className="text-xs font-mono text-slate-400 mt-1">
                  Parsing mathematical AST, checking truth-table constraints, or compiling summary sections...
                </p>
              </div>
            </div>
          ) : !solution ? (
            /* Empty State */
            <div className="border border-dashed border-[#1e293b] rounded-xl bg-[#0f1524] p-12 text-center space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#162032] border border-[#1e293b] flex items-center justify-center text-slate-400 mx-auto">
                <Calculator className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-serif font-semibold text-slate-200">
                Workspace Awaiting Problem Input
              </h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                Enter an equation, a propositional premise, or upload lecture notes on the left. The solution, verification status, and step derivations will render here.
              </p>
            </div>
          ) : (
            /* Solution Output */
            <div className="space-y-6">
              {/* Ambiguity Alert */}
              {solution.clarification_needed && (
                <div className="p-4 bg-amber-950/40 border border-amber-800/80 rounded-xl text-amber-200 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold font-mono">
                    <HelpCircle className="w-4 h-4 text-amber-400" />
                    <span>Ambiguity Detected</span>
                  </div>
                  <p className="leading-relaxed">
                    {solution.clarification_question || solution.summary_or_answer}
                  </p>
                </div>
              )}

              {/* Main Solution Card */}
              <div className="border border-[#1e293b] rounded-xl bg-[#111827] p-6 shadow-sm space-y-6">
                {/* Header: Task Badge & Title */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e293b] pb-4">
                  <div>
                    {(() => {
                      const task = getTaskInfo(solution.task_type);
                      const Icon = task.icon;
                      return (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono border ${task.badgeClass}`}
                        >
                          <Icon className="w-3 h-3" />
                          <span>Task: {task.label}</span>
                        </span>
                      );
                    })()}
                    <h2 className="font-serif text-lg font-bold text-slate-100 tracking-tight mt-2">
                      {solution.title}
                    </h2>
                  </div>

                  {/* Verification Pill */}
                  {solution.math_solution?.verification && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#0b0f19] border border-[#1e293b] text-[11px] font-mono text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>SymPy Verified ({solution.math_solution.verification.status})</span>
                    </div>
                  )}
                </div>

                {/* Conclusion / High-Level Result Block */}
                <div className="border border-[#1e293b] bg-[#0b0f19] rounded-lg p-4">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                    {solution.task_type === "summarization" ? "Core Overview" : "Final Derivation / Conclusion"}
                  </div>
                  <div className="text-sm font-semibold font-mono text-emerald-300 leading-relaxed">
                    {solution.summary_or_answer}
                  </div>
                </div>

                {/* Task-Specific Renderings */}
                {/* 1. Mathematics Steps */}
                {solution.task_type === "mathematics" && solution.math_solution && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                      Step-by-Step Mathematical Derivation
                    </h3>
                    <div className="space-y-2">
                      {solution.math_solution.steps?.map((step: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg border border-[#1e293b] bg-[#162032] space-y-1"
                        >
                          <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
                            <span className="w-4 h-4 rounded bg-[#0b0f19] border border-[#1e293b] flex items-center justify-center font-mono text-[10px] text-emerald-400">
                              {step.step || idx + 1}
                            </span>
                            <span>{step.explanation}</span>
                          </div>
                          {step.expression && (
                            <div className="pl-6 font-mono text-xs text-slate-300 bg-[#0b0f19] p-2 rounded border border-[#1e293b] overflow-x-auto">
                              {step.expression}
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
                    <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                      Formal Reasoning & Truth Table
                    </h3>
                    <div className="space-y-1.5">
                      {solution.logic_solution.reasoning_steps?.map((step: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                          <ArrowRight className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{step}</span>
                        </div>
                      ))}
                    </div>

                    {/* Truth Table */}
                    {solution.logic_solution.truth_table && (
                      <div className="mt-3 border border-[#1e293b] rounded-lg overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-[#0b0f19] text-slate-400 border-b border-[#1e293b]">
                            <tr>
                              {solution.logic_solution.truth_table.variables?.map((v: string) => (
                                <th key={v} className="p-2 font-mono">{v}</th>
                              ))}
                              <th className="p-2 font-mono text-emerald-400">Result</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1e293b]">
                            {solution.logic_solution.truth_table.rows?.map((row: any, rIdx: number) => (
                              <tr key={rIdx} className="hover:bg-[#162032]">
                                {solution.logic_solution.truth_table.variables?.map((v: string) => (
                                  <td key={v} className="p-2 font-mono text-slate-300">
                                    {row.assignment[v] ? "T" : "F"}
                                  </td>
                                ))}
                                <td className="p-2 font-mono font-bold text-emerald-400">
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
                        <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span>{sec.heading}</span>
                        </h4>
                        <ul className="list-disc pl-5 space-y-1 text-xs text-slate-400">
                          {sec.points?.map((pt: string, pIdx: number) => (
                            <li key={pIdx} className="leading-relaxed">{pt}</li>
                          ))}
                        </ul>
                      </div>
                    ))}

                    {/* Key Terms */}
                    {solution.summary_solution.content?.key_terms?.length > 0 && (
                      <div className="pt-2 border-t border-[#1e293b]">
                        <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2">
                          Key Definitions & Nomenclature
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {solution.summary_solution.content.key_terms.map((kt: any, idx: number) => (
                            <div key={idx} className="p-2.5 rounded border border-[#1e293b] bg-[#0b0f19] text-xs">
                              <span className="font-semibold text-slate-200">{kt.term}: </span>
                              <span className="text-slate-400">{kt.definition}</span>
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
                    <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                      Step-by-Step Pedagogical Explanation
                    </h3>
                    <div className="space-y-2.5">
                      {solution.educational_solution.steps?.map((st, idx) => (
                        <div key={idx} className="p-3 rounded-lg border border-[#1e293b] bg-[#162032] space-y-1">
                          <div className="text-xs font-semibold text-emerald-400">
                            {st.step}. {st.title}
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {st.explanation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Conversational Follow-Up Thread */}
              <div className="border border-[#1e293b] rounded-xl bg-[#111827] p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-400">
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Socratic Follow-Up Thread</span>
                </div>

                {followUpThread.length > 0 && (
                  <div className="space-y-2.5 pt-1">
                    {followUpThread.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg text-xs leading-relaxed ${
                          msg.role === "user"
                            ? "bg-[#162032] text-slate-200 border border-[#273b61]/60 ml-6"
                            : "bg-[#0b0f19] text-slate-300 border border-[#1e293b] mr-6"
                        }`}
                      >
                        <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                          {msg.role === "user" ? "Query" : "Explanation"}
                        </span>
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Follow-up input */}
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={followUpInput}
                    onChange={(e) => setFollowUpInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendFollowUp();
                      }
                    }}
                    placeholder="Ask a clarifying follow-up question..."
                    className="flex-1 px-3 py-2 bg-[#0b0f19] border border-[#1e293b] rounded-lg text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60"
                  />
                  <button
                    type="button"
                    onClick={handleSendFollowUp}
                    disabled={followUpLoading || !followUpInput.trim()}
                    className="px-3.5 py-2 bg-[#17223b] hover:bg-[#1c2a47] border border-[#273b61] text-xs font-medium text-slate-200 rounded-lg transition disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
                  >
                    {followUpLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5 text-emerald-400" />
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

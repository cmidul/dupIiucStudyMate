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
          badgeClass: "bg-[#3B6CFF]/15 text-[#3B6CFF] border-[#3B6CFF]/40",
        };
      case "logical_reasoning":
        return {
          icon: Binary,
          label: "Logical Reasoning",
          badgeClass: "bg-[#8E5BFF]/15 text-[#C4A8FF] border-[#8E5BFF]/40",
        };
      case "summarization":
        return {
          icon: BookOpen,
          label: "Study Summary",
          badgeClass: "bg-[#3DDC97]/15 text-[#3DDC97] border-[#3DDC97]/40",
        };
      case "general_educational":
      default:
        return {
          icon: Lightbulb,
          label: "Explanation",
          badgeClass: "bg-[#F5B84B]/15 text-[#F5B84B] border-[#F5B84B]/40",
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#2E333D] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#E8EAF0] tracking-tight">
            Solve Questions
          </h1>
          <p className="text-xs sm:text-sm text-[#A0A6B4] mt-0.5">
            Type an academic question or upload a photo to get direct answers and worked steps.
          </p>
        </div>

        {/* Mobile View Switcher */}
        <div className="flex lg:hidden rounded-xl border border-[#2E333D] bg-[#1C1F26] p-1 text-xs">
          <button
            onClick={() => setMobileTab("composer")}
            aria-pressed={mobileTab === "composer"}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              mobileTab === "composer"
                ? "bg-[#3B6CFF] text-white shadow-sm font-semibold"
                : "text-[#A0A6B4] hover:text-[#E8EAF0]"
            }`}
          >
            Question
          </button>
          <button
            onClick={() => setMobileTab("solution")}
            aria-pressed={mobileTab === "solution"}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              mobileTab === "solution"
                ? "bg-[#3B6CFF] text-white shadow-sm font-semibold"
                : "text-[#A0A6B4] hover:text-[#E8EAF0]"
            }`}
          >
            Answer
          </button>
        </div>
      </div>

      {/* Split Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(18rem,0.75fr)_minmax(0,1.25fr)] gap-6 items-start">
        {/* LEFT PANEL: COMPOSER */}
        <div
          className={`min-w-0 space-y-4 ${
            mobileTab === "solution" ? "hidden lg:block" : "block"
          }`}
        >
          <div className="bg-[#1C1F26] border border-[#2E333D] rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#E8EAF0]">Your question</h2>
              {(inputText || selectedFile) && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[11px] font-mono text-[#A0A6B4] hover:text-[#FF5C6C] transition"
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
                placeholder="Enter a formula, mathematical equation, or logic problem..."
                className="w-full p-3.5 bg-[#14161A] border border-[#2E333D] rounded-xl text-xs sm:text-sm font-mono text-[#E8EAF0] placeholder:text-[#6B7280] focus:border-[#3B6CFF] outline-none leading-relaxed resize-y transition"
              />
            </div>

            {/* Attached Image Preview */}
            {selectedFile && (
              <div className="relative border border-[#2E333D] rounded-xl p-2.5 bg-[#14161A] flex items-center justify-between">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  {filePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={filePreview}
                      alt="Source preview"
                      className="w-10 h-10 object-cover rounded-lg border border-[#2E333D]"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-[#242832] flex items-center justify-center">
                      <ImageIcon className="w-4 h-4 text-[#A0A6B4]" />
                    </div>
                  )}
                  <div className="overflow-hidden leading-tight">
                    <span className="text-xs font-medium text-[#E8EAF0] truncate block">
                      {selectedFile.name}
                    </span>
                    <span className="text-[10px] font-mono text-[#6B7280] block">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Image source
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearFile}
                  className="p-1 rounded-lg text-[#A0A6B4] hover:text-[#FF5C6C] transition"
                  aria-label="Remove attached image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Upload Controls & Preferences */}
            <div className="pt-2 border-t border-[#262A33] flex flex-wrap items-center justify-between gap-3">
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#2E333D] bg-[#14161A] hover:bg-[#242832] text-xs font-medium text-[#A0A6B4] hover:text-[#E8EAF0] transition"
                >
                  <Upload className="w-3.5 h-3.5 text-[#3B6CFF]" />
                  <span>Attach photo</span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <select
                  value={preferredStyle}
                  onChange={(e) => setPreferredStyle(e.target.value as any)}
                  aria-label="Summary style preference"
                  className="bg-[#14161A] border border-[#2E333D] rounded-lg px-2.5 py-1 text-[11px] font-mono text-[#A0A6B4] focus:outline-none"
                  title="Preferred summary depth"
                >
                  <option value="exam_notes">Exam Notes</option>
                  <option value="detailed">Detailed</option>
                  <option value="short">Concise</option>
                </select>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div role="alert" className="p-3 bg-[#FF5C6C]/10 border border-[#FF5C6C]/30 text-[#FF5C6C] rounded-xl text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[#FF5C6C] flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {/* Submit Action */}
            <button
              type="button"
              onClick={handleSolve}
              disabled={loading}
              className="w-full min-h-11 py-2.5 px-4 bg-[#3B6CFF] hover:bg-[#5A82FF] active:bg-[#2A55D9] disabled:opacity-50 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-[0_0_15px_rgba(59,108,255,0.35)] transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Solving problem…</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Solve Question</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT PANEL: AI ANSWER & EXPLANATION */}
        <div
          aria-busy={loading}
          className={`min-w-0 space-y-5 ${
            mobileTab === "composer" ? "hidden lg:block" : "block"
          }`}
        >
          {loading ? (
            <div role="status" className="bg-[#1C1F26] border border-[#2E333D] rounded-2xl p-10 text-center space-y-4 shadow-xl">
              <Loader2 className="w-8 h-8 text-[#3B6CFF] animate-spin mx-auto" />
              <div>
                <div className="text-base font-semibold text-[#E8EAF0]">
                  {selectedFile ? "Analyzing visual contents" : "Computing derivation & steps"}
                </div>
                <p className="text-xs text-[#A0A6B4] mt-1">
                  {selectedFile ? "Extracting mathematical symbols and problem context." : "Verifying algebraic consistency."}
                </p>
              </div>
            </div>
          ) : !solution ? (
            <div className="bg-[#1C1F26] border border-[#2E333D] rounded-2xl p-10 sm:p-14 text-center space-y-3 shadow-xl">
              <div className="w-12 h-12 rounded-xl bg-[#14161A] border border-[#2E333D] flex items-center justify-center text-[#3B6CFF] mx-auto">
                <Calculator className="w-6 h-6" />
              </div>
              <h2 className="text-base font-semibold text-[#E8EAF0]">
                Your solution will appear here
              </h2>
              <p className="text-xs text-[#A0A6B4] max-w-sm mx-auto leading-relaxed">
                Enter an equation or upload a photo to receive a verified result and worked derivations.
              </p>
            </div>
          ) : solution.clarification_needed ? (
            <div className="bg-[#1C1F26] border border-[#2E333D] rounded-2xl p-6 space-y-3 shadow-xl" role="status">
              <h2 ref={answerHeadingRef} tabIndex={-1} className="flex items-center gap-2 font-semibold text-[#F5B84B]">
                <HelpCircle className="w-5 h-5 text-[#F5B84B]" />
                Additional information needed
              </h2>
              <p className="text-sm leading-relaxed text-[#E8EAF0]">{solution.clarification_question || solution.summary_or_answer}</p>
              <button type="button" onClick={() => setMobileTab("composer")} className="lg:hidden text-xs font-semibold text-[#3B6CFF]">
                Edit Question
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Main Solution Card */}
              <div className="bg-[#1C1F26] border border-[#2E333D] rounded-2xl p-6 space-y-6 shadow-xl">
                {/* Header: Task Badge & Title */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#262A33] pb-4">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const task = getTaskInfo(solution.task_type);
                      const Icon = task.icon;
                      return (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border ${task.badgeClass}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{task.label}</span>
                        </span>
                      );
                    })()}
                    {solution.math_solution?.verification?.status === "passed" && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#3DDC97]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> SymPy Verified
                      </span>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopySolution}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#14161A] hover:bg-[#242832] border border-[#2E333D] text-[11px] font-mono text-[#A0A6B4] hover:text-[#E8EAF0] transition"
                      title="Copy solution markdown"
                    >
                      {copiedSolution ? (
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
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#14161A] hover:bg-[#242832] border border-[#2E333D] text-[11px] font-mono text-[#A0A6B4] hover:text-[#E8EAF0] transition"
                      title="Export solution as markdown"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export .md</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePrint}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#14161A] hover:bg-[#242832] border border-[#2E333D] text-[11px] font-mono text-[#A0A6B4] hover:text-[#E8EAF0] transition"
                      title="Print or save as PDF"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print</span>
                    </button>
                  </div>
                </div>

                {/* Primary Answer Panel */}
                <section aria-labelledby="answer-heading" className="bg-[#14161A] border border-[#2E333D] rounded-xl p-5 sm:p-6 space-y-3">
                  <h2 id="answer-heading" ref={answerHeadingRef} tabIndex={-1} className="text-lg font-semibold text-[#E8EAF0]">
                    {solution.task_type === "summarization" ? "Key Takeaways" : "Direct Answer"}
                  </h2>
                  <SolutionText text={solution.summary_or_answer} />
                </section>

                {/* Mathematics Steps */}
                {solution.task_type === "mathematics" && solution.math_solution && (
                  <div className="space-y-4">
                    <h3 className="text-base font-semibold text-[#E8EAF0]">
                      Worked Mathematical Steps
                    </h3>
                    <div className="space-y-3">
                      {solution.math_solution.steps?.map((step: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-4 rounded-xl border border-[#2E333D] bg-[#14161A] space-y-2"
                        >
                          <div className="flex items-start gap-2.5 text-xs sm:text-sm font-medium text-[#E8EAF0]">
                            <span className="w-5 h-5 rounded-md bg-[#242832] border border-[#2E333D] flex items-center justify-center font-mono text-xs text-[#3B6CFF] flex-shrink-0 mt-0.5">
                              {step.step || idx + 1}
                            </span>
                            <FormattedTextWithMath text={step.explanation} className="leading-relaxed" />
                          </div>
                          {step.expression && (
                            <div className="pl-7 py-1">
                              <MathBlock
                                content={step.expression}
                                block={true}
                                className="text-[#E8EAF0]"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Logical Reasoning */}
                {solution.task_type === "logical_reasoning" && solution.logic_solution && (
                  <div className="space-y-4">
                    <h3 className="text-base font-semibold text-[#E8EAF0]">
                      Formal Logical Steps
                    </h3>
                    <div className="space-y-2">
                      {solution.logic_solution.reasoning_steps?.map((step: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-[#E8EAF0] p-3 rounded-xl bg-[#14161A] border border-[#2E333D]">
                          <ArrowRight className="w-4 h-4 text-[#3B6CFF] flex-shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{step}</span>
                        </div>
                      ))}
                    </div>

                    {/* Truth Table */}
                    {solution.logic_solution.truth_table && (
                      <div className="mt-4 border border-[#2E333D] rounded-xl overflow-x-auto bg-[#14161A]">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-[#1C1F26] text-[#A0A6B4] border-b border-[#2E333D]">
                            <tr>
                              {solution.logic_solution.truth_table.variables?.map((v: string) => (
                                <th key={v} className="p-3 font-mono">{v}</th>
                              ))}
                              <th className="p-3 font-mono text-[#3B6CFF]">Result</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#262A33]">
                            {solution.logic_solution.truth_table.rows?.map((row: any, rIdx: number) => (
                              <tr key={rIdx} className="hover:bg-[#242832]">
                                {solution.logic_solution.truth_table.variables?.map((v: string) => (
                                  <td key={v} className="p-3 font-mono text-[#E8EAF0]">
                                    {row.assignment[v] ? "T" : "F"}
                                  </td>
                                ))}
                                <td className="p-3 font-mono font-bold text-[#3B6CFF]">
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

                {/* Summarization */}
                {solution.task_type === "summarization" && solution.summary_solution && (
                  <div className="space-y-4">
                    {solution.summary_solution.content?.sections?.map((sec: any, idx: number) => (
                      <div key={idx} className="space-y-2 p-4 rounded-xl bg-[#14161A] border border-[#2E333D]">
                        <h4 className="text-xs font-mono uppercase tracking-wider text-[#3B6CFF] flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#3B6CFF]"></span>
                          <span>{sec.heading}</span>
                        </h4>
                        <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-[#A0A6B4]">
                          {sec.points?.map((pt: string, pIdx: number) => (
                            <li key={pIdx} className="leading-relaxed text-[#E8EAF0]">{pt}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pedagogical QA */}
                {solution.task_type === "general_educational" && solution.educational_solution && (
                  <div className="space-y-4">
                    <h3 className="text-base font-semibold text-[#E8EAF0]">
                      Key Concept Breakdown
                    </h3>
                    <div className="space-y-3">
                      {solution.educational_solution.steps?.map((st, idx) => (
                        <div key={idx} className="p-4 rounded-xl border border-[#2E333D] bg-[#14161A] space-y-1.5">
                          <div className="text-sm font-semibold text-[#3B6CFF]">
                            {st.step}. {st.title}
                          </div>
                          <SolutionText text={st.explanation} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Follow-up thread */}
              <div className="bg-[#1C1F26] border border-[#2E333D] rounded-2xl p-5 space-y-4 shadow-xl">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-[#E8EAF0]">
                  <RefreshCw className="w-4 h-4 text-[#3B6CFF]" />
                  <span>Ask a follow-up question</span>
                </h2>

                {followUpThread.length > 0 && (
                  <div className="space-y-3">
                    {followUpThread.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl text-xs sm:text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-[#242832] text-[#E8EAF0] border border-[#2E333D] ml-6"
                            : "bg-[#14161A] text-[#A0A6B4] border border-[#262A33] mr-6"
                        }`}
                      >
                        <span className="text-[10px] font-mono uppercase text-[#3B6CFF] block mb-1">
                          {msg.role === "user" ? "You" : "StudyMate"}
                        </span>
                        <FormattedTextWithMath text={msg.content} className="whitespace-pre-wrap text-[#E8EAF0]" />
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
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
                    placeholder="Ask a clarifying question about this answer..."
                    className="min-w-0 flex-1 px-3.5 py-2.5 bg-[#14161A] border border-[#2E333D] rounded-xl text-xs sm:text-sm text-[#E8EAF0] placeholder:text-[#6B7280] focus:border-[#3B6CFF] outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSendFollowUp}
                    disabled={followUpLoading || !followUpInput.trim()}
                    className="px-4 py-2.5 bg-[#3B6CFF] hover:bg-[#5A82FF] active:bg-[#2A55D9] disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-[0_0_12px_rgba(59,108,255,0.25)] transition flex items-center gap-1.5 flex-shrink-0"
                  >
                    {followUpLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">Ask</span>
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
        <div className="flex-1 flex items-center justify-center p-8 text-[#A0A6B4] text-xs font-mono">
          Loading Unified Solve Workspace...
        </div>
      }
    >
      <SolveWorkspaceContent />
    </Suspense>
  );
}

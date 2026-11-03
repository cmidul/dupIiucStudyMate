"use client";

import React, { useState, useRef } from "react";
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

export default function SolvePage() {
  const [inputText, setInputText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [preferredStyle, setPreferredStyle] = useState<"exam_notes" | "detailed" | "short">("exam_notes");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [solution, setSolution] = useState<UnifiedSolveResponse | null>(null);

  // Follow-up state
  const [followUpInput, setFollowUpInput] = useState("");
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpThread, setFollowUpThread] = useState<FollowUpMessage[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
      setFilePreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSolve = async () => {
    if (!inputText.trim() && !selectedFile) {
      setErrorMsg("Please enter a question, problem, passage, or select an image to solve.");
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
        });
      }
      setSolution(res);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || "Failed to solve the question. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendFollowUp = async () => {
    if (!followUpInput.trim() || !solution?.conversation_id) return;

    const userMsg = followUpInput.trim();
    setFollowUpInput("");
    setFollowUpLoading(true);

    // Optimistically add user message
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
          content: `❌ Error: ${error.message || "Failed to get follow-up answer."}`,
        },
      ]);
    } finally {
      setFollowUpLoading(false);
    }
  };

  const getTaskBadge = (taskType: TaskType) => {
    switch (taskType) {
      case "mathematics":
        return {
          icon: Calculator,
          label: "Mathematics",
          bg: "bg-blue-50 text-blue-700 border-blue-200",
        };
      case "logical_reasoning":
        return {
          icon: Binary,
          label: "Logical Reasoning",
          bg: "bg-purple-50 text-purple-700 border-purple-200",
        };
      case "summarization":
        return {
          icon: BookOpen,
          label: "Study Summary",
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        };
      case "general_educational":
      default:
        return {
          icon: Lightbulb,
          label: "Educational Explanation",
          bg: "bg-amber-50 text-amber-700 border-amber-200",
        };
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 w-full">
      {/* Title & Introduction */}
      <div>
        <div className="flex items-center gap-2">
          <span className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
            <Sparkles className="w-5 h-5" />
          </span>
          <h1 className="text-2xl font-extrabold text-slate-800">Solve Questions</h1>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Unified solver for mathematics, logical reasoning, educational summaries, and conceptual questions.
          Type any problem or upload an image—the AI automatically detects and solves it step by step.
        </p>
      </div>

      {/* Input Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div>
          <label htmlFor="problem-input" className="block text-sm font-semibold text-slate-700 mb-1">
            Question, Problem, Equation, or Educational Material
          </label>
          <textarea
            id="problem-input"
            rows={4}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="e.g. 'Solve x^2 - 5x + 6 = 0', or 'If all humans are mortal and Socrates is human, is Socrates mortal?', or paste a lecture passage to summarize..."
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono placeholder:font-sans placeholder:text-slate-400"
          />
        </div>

        {/* Image Attachment & Style Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-3">
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
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-600" />
              <span>Attach Image</span>
            </button>

            {selectedFile && (
              <div className="flex items-center gap-2 bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-md border border-slate-200">
                <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                <span className="max-w-[150px] truncate">{selectedFile.name}</span>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="text-slate-400 hover:text-red-500"
                  aria-label="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">If summarizing:</span>
            <select
              value={preferredStyle}
              onChange={(e) => setPreferredStyle(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none"
            >
              <option value="exam_notes">Exam Notes</option>
              <option value="detailed">Detailed</option>
              <option value="short">Short</option>
            </select>
          </div>
        </div>

        {/* Image Preview Box */}
        {filePreview && (
          <div className="relative inline-block mt-2 border border-slate-200 rounded-xl overflow-hidden bg-slate-50 max-h-48">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={filePreview} alt="Upload preview" className="object-contain max-h-48" />
          </div>
        )}

        {/* Error message display */}
        {errorMsg && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Solve Submit Button */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSolve}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analyzing & Solving...</span>
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

      {/* Solution Display Card */}
      {solution && (
        <div className="space-y-6">
          {/* Ambiguity / Clarification Alert */}
          {solution.clarification_needed && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <HelpCircle className="w-4 h-4 text-amber-600" />
                <span>Clarification Needed</span>
              </div>
              <p className="text-sm">{solution.clarification_question || solution.summary_or_answer}</p>
            </div>
          )}

          {/* Main Result Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            {/* Header with Detected Task Badge */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                {(() => {
                  const badge = getTaskBadge(solution.task_type);
                  const Icon = badge.icon;
                  return (
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badge.bg}`}>
                        <Icon className="w-3.5 h-3.5" />
                        <span>Detected: {badge.label}</span>
                      </span>
                    </div>
                  );
                })()}
                <h2 className="text-xl font-bold text-slate-800 mt-2">{solution.title}</h2>
              </div>

              {solution.math_solution?.verification && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>SymPy Verified ({solution.math_solution.verification.status})</span>
                </div>
              )}
            </div>

            {/* Answer / Conclusion Banner */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                {solution.task_type === "summarization" ? "Overview" : "Conclusion / Final Answer"}
              </div>
              <div className="text-base font-semibold text-slate-900 font-mono">
                {solution.summary_or_answer}
              </div>
            </div>

            {/* Specific Renderings based on task_type */}
            {/* 1. Mathematics Steps */}
            {solution.task_type === "mathematics" && solution.math_solution && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800">Step-by-Step Mathematical Solution</h3>
                <div className="space-y-3">
                  {solution.math_solution.steps?.map((step: any, idx: number) => (
                    <div key={idx} className="p-3.5 rounded-xl border border-slate-100 bg-white shadow-xs space-y-1">
                      <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700">
                        <span className="w-5 h-5 rounded-full bg-indigo-50 flex items-center justify-center">
                          {step.step || idx + 1}
                        </span>
                        <span>{step.explanation}</span>
                      </div>
                      {step.expression && (
                        <div className="pl-7 font-mono text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 mt-1">
                          {step.expression}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Logical Reasoning Steps */}
            {solution.task_type === "logical_reasoning" && solution.logic_solution && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800">Logical Reasoning & Proof</h3>
                <div className="space-y-2">
                  {solution.logic_solution.reasoning_steps?.map((step: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                      <ArrowRight className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>

                {/* Truth Table if present */}
                {solution.logic_solution.truth_table && (
                  <div className="mt-4 border border-slate-200 rounded-xl overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <tr>
                          {solution.logic_solution.truth_table.variables?.map((v: string) => (
                            <th key={v} className="p-2 font-mono">{v}</th>
                          ))}
                          <th className="p-2 font-mono">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {solution.logic_solution.truth_table.rows?.map((row: any, rIdx: number) => (
                          <tr key={rIdx} className="border-b border-slate-100">
                            {solution.logic_solution.truth_table.variables?.map((v: string) => (
                              <td key={v} className="p-2 font-mono">
                                {row.assignment[v] ? "T" : "F"}
                              </td>
                            ))}
                            <td className="p-2 font-mono font-bold text-indigo-600">
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

            {/* 3. Summarization Sections */}
            {solution.task_type === "summarization" && solution.summary_solution && (
              <div className="space-y-6">
                {solution.summary_solution.content?.sections?.map((sec: any, idx: number) => (
                  <div key={idx} className="space-y-2">
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>{sec.heading}</span>
                    </h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-slate-600">
                      {sec.points?.map((pt: string, pIdx: number) => (
                        <li key={pIdx}>{pt}</li>
                      ))}
                    </ul>
                  </div>
                ))}

                {/* Key Terms */}
                {solution.summary_solution.content?.key_terms?.length > 0 && (
                  <div className="pt-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Key Terms</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {solution.summary_solution.content.key_terms.map((kt: any, idx: number) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                          <span className="font-bold text-slate-800">{kt.term}: </span>
                          <span className="text-slate-600">{kt.definition}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 4. Educational QA Steps */}
            {solution.task_type === "general_educational" && solution.educational_solution && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800">Pedagogical Explanation Steps</h3>
                <div className="space-y-3">
                  {solution.educational_solution.steps?.map((step, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl border border-slate-100 bg-white space-y-1">
                      <div className="font-semibold text-xs text-amber-700">
                        Step {step.step}: {step.title}
                      </div>
                      <div className="text-xs text-slate-600 leading-relaxed">
                        {step.explanation}
                      </div>
                    </div>
                  ))}
                </div>

                {solution.educational_solution.key_concepts?.length > 0 && (
                  <div className="pt-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Key Concepts</h4>
                    <div className="space-y-1.5">
                      {solution.educational_solution.key_concepts.map((kc, idx) => (
                        <div key={idx} className="text-xs text-slate-700">
                          <span className="font-bold">{kc.concept}: </span>
                          <span>{kc.explanation}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Interactive Follow-up Conversation Section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-indigo-600" />
              <span>Ask Follow-up Questions</span>
            </h3>
            <p className="text-xs text-slate-500">
              Continue exploring this problem or topic. The assistant preserves the full context of this solution.
            </p>

            {/* Thread messages */}
            {followUpThread.length > 0 && (
              <div className="space-y-3 pt-2">
                {followUpThread.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-indigo-50 text-indigo-900 border border-indigo-100 ml-8"
                        : "bg-slate-50 text-slate-800 border border-slate-100 mr-8"
                    }`}
                  >
                    <div className="font-bold mb-1 text-[11px] uppercase tracking-wider text-slate-400">
                      {msg.role === "user" ? "You" : "Assistant"}
                    </div>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Follow-up input form */}
            <div className="flex gap-2 pt-2">
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
                placeholder="Ask a follow-up question (e.g. 'Can you explain step 2 further?')..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleSendFollowUp}
                disabled={followUpLoading || !followUpInput.trim()}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {followUpLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Send</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

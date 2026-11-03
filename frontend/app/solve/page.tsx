"use client";

import React, { useState } from "react";
import {
  Calculator,
  Binary,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  Loader2,
} from "lucide-react";
import { api, MathSolution, LogicSolution } from "@/lib/api";

export default function SolvePage() {
  const [tab, setTab] = useState<"math" | "logic">("math");

  // Math State
  const [mathInput, setMathInput] = useState("");
  const [mathResult, setMathResult] = useState<MathSolution | null>(null);

  // Logic State
  const [premisesInput, setPremisesInput] = useState("");
  const [conclusionInput, setConclusionInput] = useState("");
  const [logicResult, setLogicResult] = useState<LogicSolution | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSolveMath = async () => {
    if (!mathInput.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    setMathResult(null);

    try {
      const res = await api.solveMath({ expression: mathInput.trim() });
      setMathResult(res);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || "Failed to solve mathematical expression.");
    } finally {
      setLoading(false);
    }
  };

  const handleSolveLogic = async () => {
    const premises = premisesInput
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean);

    if (premises.length === 0) {
      setErrorMsg("Please enter at least one premise.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setLogicResult(null);

    try {
      const res = await api.solveLogic({
        premises,
        conclusion: conclusionInput.trim() || undefined,
      });
      setLogicResult(res);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || "Failed to evaluate logical reasoning problem.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">
          Math & Logic Problem Solvers
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Rigorous symbolic verification using SymPy (zero eval) and deterministic truth-table / syllogism logic engines.
        </p>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => {
            setTab("math");
            setErrorMsg(null);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
            tab === "math"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>Math Solver</span>
        </button>

        <button
          onClick={() => {
            setTab("logic");
            setErrorMsg(null);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
            tab === "logic"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          <Binary className="w-4 h-4" />
          <span>Logical Reasoning</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* MATH SOLVER TAB (WEB-007) */}
      {tab === "math" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div>
              <label htmlFor="math-exp" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Mathematical Expression or Equation
              </label>
              <input
                id="math-exp"
                type="text"
                value={mathInput}
                onChange={(e) => setMathInput(e.target.value)}
                placeholder="e.g. 2*x + 5 = 15, x^2 - 5*x + 6 = 0, 10 + 4 * (3 - 1)"
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSolveMath}
                disabled={loading || !mathInput.trim()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition flex items-center gap-2 shadow-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>Solve & Verify</span>
              </button>
            </div>
          </div>

          {/* Math Results */}
          {mathResult && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Problem Type</h3>
                  <p className="text-base font-bold text-slate-800 capitalize">{mathResult.problem_type}</p>
                </div>

                <div
                  className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                    mathResult.verification_status === "verified"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="capitalize">{mathResult.verification_status}</span>
                </div>
              </div>

              {/* Ambiguity Prompt */}
              {mathResult.is_ambiguous && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                  <span className="font-bold">⚠️ Ambiguity Detected:</span>
                  <p>{mathResult.clarification_needed}</p>
                </div>
              )}

              {/* Step-by-Step Reasoning */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Solution Steps
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
                  {mathResult.steps.map((st, i) => (
                    <li key={i} className="pl-1 leading-relaxed">
                      {st}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Final Answer */}
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Final Answer</span>
                <div className="text-lg font-mono font-bold text-indigo-950 mt-1">
                  {mathResult.final_answer}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LOGIC SOLVER TAB (WEB-007) */}
      {tab === "logic" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div>
              <label htmlFor="logic-premises" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Premises (One per line)
              </label>
              <textarea
                id="logic-premises"
                rows={3}
                value={premisesInput}
                onChange={(e) => setPremisesInput(e.target.value)}
                placeholder="e.g.&#10;All humans are mortal&#10;Socrates is a human"
                className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="logic-conclusion" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Conclusion to Validate (Optional)
              </label>
              <input
                id="logic-conclusion"
                type="text"
                value={conclusionInput}
                onChange={(e) => setConclusionInput(e.target.value)}
                placeholder="e.g. Socrates is mortal"
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSolveLogic}
                disabled={loading || !premisesInput.trim()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition flex items-center gap-2 shadow-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>Evaluate Logic</span>
              </button>
            </div>
          </div>

          {/* Logic Results */}
          {logicResult && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Problem Classification</h3>
                  <p className="text-base font-bold text-slate-800 capitalize">{logicResult.problem_type.replace("_", " ")}</p>
                </div>

                {logicResult.is_valid !== undefined && (
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                      logicResult.is_valid
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {logicResult.is_valid ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    <span>{logicResult.is_valid ? "Valid Deduction" : "Invalid / Fallacy"}</span>
                  </div>
                )}
              </div>

              {/* Reasoning Steps */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Deductive Steps
                </h4>
                <ul className="list-disc list-inside space-y-1.5 text-sm text-slate-700">
                  {logicResult.reasoning_steps.map((st, i) => (
                    <li key={i}>{st}</li>
                  ))}
                </ul>
              </div>

              {/* Truth Table view if available */}
              {logicResult.truth_table && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Truth Table
                  </h4>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <tr>
                          {logicResult.truth_table.variables.map((v) => (
                            <th key={v} className="px-3 py-2 text-center font-mono">{v}</th>
                          ))}
                          <th className="px-3 py-2 text-center font-mono">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {logicResult.truth_table.rows.map((row, idx) => (
                          <tr key={idx}>
                            {logicResult.truth_table?.variables.map((v) => (
                              <td key={v} className="px-3 py-1.5 text-center">
                                {row.assignments[v] ? "T" : "F"}
                              </td>
                            ))}
                            <td className={`px-3 py-1.5 text-center font-bold ${row.result ? "text-emerald-600" : "text-red-500"}`}>
                              {row.result ? "T" : "F"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


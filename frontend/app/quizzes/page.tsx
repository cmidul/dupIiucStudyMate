"use client";

import React, { useState } from "react";
import {
  Award,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { api, QuizDelivery, QuizAttemptResult } from "@/lib/api";

export default function QuizzesPage() {
  const [topicInput, setTopicInput] = useState("");
  const [difficulty, setDifficulty] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [questionCount, setQuestionCount] = useState(5);
  const [quiz, setQuiz] = useState<QuizDelivery | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [attemptResult, setAttemptResult] = useState<QuizAttemptResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!topicInput.trim()) {
      setErrorMsg("Please enter a study topic.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setAttemptResult(null);
    setSelectedAnswers({});
    setCurrentIndex(0);

    try {
      const q = await api.generateQuiz({
        topic: topicInput.trim(),
        difficulty,
        question_count: questionCount,
      });
      setQuiz(q);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || "Failed to generate practice quiz.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (questionId: string, optionId: string) => {
    if (attemptResult) return; // Locked after submission (WEB-006)
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));
  };

  const handleSubmit = async () => {
    if (!quiz) return;
    const answeredCount = Object.keys(selectedAnswers).length;
    if (answeredCount < quiz.questions.length) {
      if (!confirm(`You have answered ${answeredCount} of ${quiz.questions.length} questions. Submit anyway?`)) {
        return;
      }
    }

    setLoading(true);
    try {
      const payload = Object.entries(selectedAnswers).map(([qid, oid]) => ({
        question_id: qid,
        selected_option_id: oid,
      }));
      const res = await api.submitQuizAttempt(quiz.id, payload);
      setAttemptResult(res);
      setCurrentIndex(0);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || "Failed to grade attempt.");
    } finally {
      setLoading(false);
    }
  };

  const activeQuestion = quiz?.questions[currentIndex];
  const activeReview = attemptResult?.reviews.find(
    (r) => r.question_id === activeQuestion?.id
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">
          Practice Quiz Workspace
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Generate multiple-choice quizzes to validate understanding. Answer keys remain sealed on the server until completion.
        </p>
      </div>

      {/* Generator Controls */}
      {!quiz && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div>
            <label htmlFor="quiz-topic" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Topic or Material
            </label>
            <input
              id="quiz-topic"
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder="e.g. Data Structures, Cell Mitosis, Newton's Laws..."
              className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Difficulty
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["beginner", "intermediate", "advanced"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={`py-2 text-xs font-semibold rounded-xl border transition capitalize ${
                      difficulty === d
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="q-count" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Number of Questions ({questionCount})
              </label>
              <input
                id="q-count"
                type="range"
                min={1}
                max={15}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition flex items-center gap-2 shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Questions...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Quiz</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Quiz Delivery & Interaction Viewport (WEB-006) */}
      {quiz && activeQuestion && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
          {/* Progress & Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">{quiz.title}</h2>
              <p className="text-xs text-slate-400 capitalize">
                {quiz.difficulty} • Question {currentIndex + 1} of {quiz.questions.length}
              </p>
            </div>

            {/* Score Banner after submission */}
            {attemptResult && (
              <div className="px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-right">
                <div className="text-xs text-indigo-600 font-semibold uppercase tracking-wider">
                  Final Score
                </div>
                <div className="text-lg font-extrabold text-indigo-900">
                  {attemptResult.score} / {attemptResult.total_questions} ({attemptResult.percentage}%)
                </div>
              </div>
            )}
          </div>

          {/* Question Text */}
          <div className="text-base font-semibold text-slate-900 leading-relaxed">
            {activeQuestion.question}
          </div>

          {/* Options */}
          <div className="space-y-3">
            {activeQuestion.options.map((opt) => {
              const isSelected = selectedAnswers[activeQuestion.id] === opt.id;
              const isCorrectOpt = activeReview && activeReview.correct_option_id === opt.id;
              const isWrongOpt = activeReview && isSelected && !activeReview.is_correct;

              let optionStyle = "border-slate-200 hover:border-indigo-400 bg-slate-50";
              if (isSelected && !attemptResult) {
                optionStyle = "border-indigo-600 bg-indigo-50 text-indigo-900 font-medium";
              }
              if (attemptResult) {
                if (isCorrectOpt) {
                  optionStyle = "border-emerald-500 bg-emerald-50 text-emerald-900 font-medium";
                } else if (isWrongOpt) {
                  optionStyle = "border-red-400 bg-red-50 text-red-900";
                } else {
                  optionStyle = "border-slate-200 opacity-60";
                }
              }

              return (
                <div
                  key={opt.id}
                  onClick={() => handleSelectOption(activeQuestion.id, opt.id)}
                  className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition ${optionStyle}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full border border-slate-300 flex items-center justify-center text-xs font-bold text-slate-600">
                      {opt.id}
                    </span>
                    <span className="text-sm">{opt.text}</span>
                  </div>

                  {attemptResult && (
                    <div>
                      {isCorrectOpt && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                      {isWrongOpt && <XCircle className="w-5 h-5 text-red-500" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Explanation Review (WEB-006) */}
          {activeReview && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
              <span className="font-bold text-slate-800">Explanation:</span>
              <p className="leading-relaxed">{activeReview.explanation}</p>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <div className="flex items-center gap-2">
              {currentIndex < quiz.questions.length - 1 ? (
                <button
                  onClick={() => setCurrentIndex((prev) => prev + 1)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition flex items-center gap-1.5"
                >
                  <span>Next</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : !attemptResult ? (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition shadow-sm"
                >
                  {loading ? "Grading..." : "Submit Answers"}
                </button>
              ) : (
                <button
                  onClick={() => {
                    setQuiz(null);
                    setAttemptResult(null);
                  }}
                  className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-900 transition flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>New Quiz</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


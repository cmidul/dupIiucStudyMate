"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Clock,
  Flag,
  BookOpen,
  Check,
  AlertCircle,
  FileCheck,
  BarChart2,
} from "lucide-react";
import { api, QuizDelivery, QuizAttemptResult } from "@/lib/api";

type QuizMode = "examination" | "practice";

export default function QuizzesPage() {
  const [mode, setMode] = useState<QuizMode>("examination");
  const [topicInput, setTopicInput] = useState("");
  const [difficulty, setDifficulty] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [questionCount, setQuestionCount] = useState(5);
  
  // Quiz state
  const [quiz, setQuiz] = useState<QuizDelivery | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [attemptResult, setAttemptResult] = useState<QuizAttemptResult | null>(null);
  const [practiceReviews, setPracticeReviews] = useState<Record<string, { is_correct: boolean; correct_option_id: string; explanation: string }>>({});
  
  // Timer state for Exam Mode
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  const [loading, setLoading] = useState(false);
  const [gradingLoading, setGradingLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState<"all" | "incorrect" | "correct">("all");

  // Timer interval
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleGenerate = async () => {
    if (!topicInput.trim()) {
      setErrorMsg("Please enter a subject or study topic.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setAttemptResult(null);
    setSelectedAnswers({});
    setFlaggedQuestions({});
    setPracticeReviews({});
    setCurrentIndex(0);
    setSecondsElapsed(0);

    try {
      const q = await api.generateQuiz({
        topic: topicInput.trim(),
        difficulty,
        question_count: questionCount,
      });
      setQuiz(q);
      setTimerActive(true);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || "Failed to generate academic quiz.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (questionId: string, optionId: string) => {
    if (attemptResult) return; // Locked after final submission
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));
  };

  const handleToggleFlag = (questionId: string) => {
    setFlaggedQuestions((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  // Practice Mode: Check immediate answer
  const handleCheckPracticeAnswer = async (questionId: string) => {
    const chosen = selectedAnswers[questionId];
    if (!quiz || !chosen) return;
    setGradingLoading(true);
    try {
      const res = await api.submitQuizAttempt(quiz.id, [
        { question_id: questionId, selected_option_id: chosen },
      ]);
      const rev = res.reviews.find((r) => r.question_id === questionId);
      if (rev) {
        setPracticeReviews((prev) => ({
          ...prev,
          [questionId]: {
            is_correct: rev.is_correct,
            correct_option_id: rev.correct_option_id,
            explanation: rev.explanation,
          },
        }));
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || "Failed to verify answer.");
    } finally {
      setGradingLoading(false);
    }
  };

  // Exam Mode: Submit entire attempt
  const handleSubmitExamination = async () => {
    if (!quiz) return;
    const answeredCount = Object.keys(selectedAnswers).length;
    if (answeredCount < quiz.questions.length) {
      const proceed = confirm(
        `You have answered ${answeredCount} of ${quiz.questions.length} questions. Are you sure you wish to submit?`
      );
      if (!proceed) return;
    }

    setGradingLoading(true);
    setTimerActive(false);
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
      setErrorMsg(error.message || "Failed to grade examination.");
      setTimerActive(true);
    } finally {
      setGradingLoading(false);
    }
  };

  const handleResetQuiz = () => {
    setQuiz(null);
    setAttemptResult(null);
    setSelectedAnswers({});
    setFlaggedQuestions({});
    setPracticeReviews({});
    setSecondsElapsed(0);
    setTimerActive(false);
    setCurrentIndex(0);
  };

  const activeQuestion = quiz?.questions[currentIndex];
  const activeReview = attemptResult?.reviews.find((r) => r.question_id === activeQuestion?.id);
  const activePracticeReview = activeQuestion ? practiceReviews[activeQuestion.id] : undefined;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-scholar-emerald font-semibold">
            Assessment & Retrieval
          </span>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 dark:text-slate-100 mt-1">
            Academic Assessment Generator
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Generate formal examinations or guided practice sessions with sealed server-side evaluation.
          </p>
        </div>

        {/* Mode Selector */}
        {!quiz && (
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-midnight-900 border border-slate-200 dark:border-slate-800 rounded-lg self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setMode("examination")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                mode === "examination"
                  ? "bg-white dark:bg-midnight-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700 font-semibold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Examination Mode
            </button>
            <button
              type="button"
              onClick={() => setMode("practice")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                mode === "practice"
                  ? "bg-white dark:bg-midnight-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700 font-semibold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Practice Mode
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-xl text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Generator Configuration Panel */}
      {!quiz && (
        <div className="bg-white dark:bg-midnight-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
          <div className="space-y-2">
            <label htmlFor="quiz-topic" className="block text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 font-semibold">
              Subject Domain or Study Topic
            </label>
            <input
              id="quiz-topic"
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder="e.g., Computer Architecture: Cache Coherence & MESI Protocol"
              className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-midnight-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:bg-white dark:focus:bg-midnight-900 focus:outline-none focus:ring-1 focus:ring-scholar-emerald text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 font-semibold mb-2">
                Academic Rigor / Difficulty
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["beginner", "intermediate", "advanced"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={`py-2 text-xs font-medium rounded-lg border transition capitalize ${
                      difficulty === d
                        ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 font-semibold"
                        : "bg-slate-50 dark:bg-midnight-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="q-count" className="text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 font-semibold">
                  Assessment Volume
                </label>
                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                  {questionCount} Questions
                </span>
              </div>
              <input
                id="q-count"
                type="range"
                min={3}
                max={15}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full accent-scholar-emerald cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
                <span>3 (Brief)</span>
                <span>8 (Standard)</span>
                <span>15 (Comprehensive)</span>
              </div>
            </div>
          </div>

          {/* Mode Explanatory Banner */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-midnight-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-scholar-emerald" />
              {mode === "examination" ? "Examination Mode Details" : "Practice Mode Details"}
            </span>
            <p className="leading-relaxed">
              {mode === "examination"
                ? "Timed simulation. Answer keys and detailed derivations remain strictly sealed on the server until submission. Questions can be flagged and reviewed prior to grading."
                : "Interactive study workflow. Immediate answers and full step explanations can be validated question-by-question as you learn."}
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="px-6 py-2.5 bg-slate-900 dark:bg-scholar-emerald hover:bg-slate-800 dark:hover:bg-emerald-600 disabled:opacity-50 text-white dark:text-slate-950 text-xs font-semibold rounded-xl transition flex items-center gap-2 shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Assessment...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Assessment</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Active Assessment Viewport */}
      {quiz && activeQuestion && !attemptResult && (
        <div className="space-y-6">
          {/* Top Status Bar: Topic, Timer & Progress */}
          <div className="bg-white dark:bg-midnight-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 md:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-midnight-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    {quiz.difficulty}
                  </span>
                  <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${
                    mode === "examination"
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  }`}>
                    {mode === "examination" ? "Formal Examination" : "Practice Mode"}
                  </span>
                </div>
                <h2 className="text-lg md:text-xl font-serif font-bold text-slate-900 dark:text-slate-100 mt-1">
                  {quiz.title}
                </h2>
              </div>

              {/* Timer in Exam Mode */}
              {mode === "examination" && (
                <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-50 dark:bg-midnight-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 font-mono text-sm self-start sm:self-auto">
                  <Clock className="w-4 h-4 text-scholar-emerald" />
                  <span>Elapsed: {formatTime(secondsElapsed)}</span>
                </div>
              )}
            </div>

            {/* Question Navigation Palette */}
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {quiz.questions.map((q, idx) => {
                  const isCurrent = idx === currentIndex;
                  const isAnswered = selectedAnswers[q.id] !== undefined;
                  const isFlagged = flaggedQuestions[q.id];

                  let pillStyle = "bg-slate-50 dark:bg-midnight-950 border-slate-200 dark:border-slate-800 text-slate-500";
                  if (isCurrent) {
                    pillStyle = "ring-2 ring-scholar-emerald font-bold border-transparent bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900";
                  } else if (isAnswered) {
                    pillStyle = "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-medium";
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={`relative w-8 h-8 rounded-lg border text-xs font-mono transition flex items-center justify-center ${pillStyle}`}
                    >
                      <span>{idx + 1}</span>
                      {isFlagged && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border border-white dark:border-midnight-900" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Answered: {Object.keys(selectedAnswers).length} / {quiz.questions.length}
              </div>
            </div>
          </div>

          {/* Question Card */}
          <div className="bg-white dark:bg-midnight-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-mono text-scholar-emerald font-semibold uppercase">
                  Item {currentIndex + 1} of {quiz.questions.length} • 1.0 Point
                </span>
                <div className="text-base md:text-lg font-serif font-medium text-slate-900 dark:text-slate-100 mt-2 leading-relaxed">
                  {activeQuestion.question}
                </div>
              </div>

              {mode === "examination" && (
                <button
                  type="button"
                  onClick={() => handleToggleFlag(activeQuestion.id)}
                  title={flaggedQuestions[activeQuestion.id] ? "Unflag question" : "Flag for review"}
                  className={`p-2 rounded-lg border transition ${
                    flaggedQuestions[activeQuestion.id]
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                      : "bg-slate-50 dark:bg-midnight-950 border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  }`}
                >
                  <Flag className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Multiple Choice Options */}
            <div className="space-y-3 pt-2">
              {activeQuestion.options.map((opt) => {
                const isSelected = selectedAnswers[activeQuestion.id] === opt.id;
                const isPracticeChecked = activePracticeReview !== undefined;
                const isPracticeCorrect = isPracticeChecked && activePracticeReview.correct_option_id === opt.id;
                const isPracticeWrong = isPracticeChecked && isSelected && !activePracticeReview.is_correct;

                let optStyle = "bg-slate-50 dark:bg-midnight-950/60 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-600";
                if (isSelected && !isPracticeChecked) {
                  optStyle = "bg-slate-900 text-white dark:bg-midnight-800 dark:text-scholar-emerald border-slate-900 dark:border-scholar-emerald";
                }
                if (isPracticeChecked) {
                  if (isPracticeCorrect) {
                    optStyle = "bg-emerald-500/10 border-emerald-500 text-emerald-900 dark:text-emerald-300 font-medium";
                  } else if (isPracticeWrong) {
                    optStyle = "bg-red-500/10 border-red-500 text-red-900 dark:text-red-300";
                  } else {
                    optStyle = "opacity-50 border-slate-200 dark:border-slate-800";
                  }
                }

                return (
                  <div
                    key={opt.id}
                    onClick={() => handleSelectOption(activeQuestion.id, opt.id)}
                    className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition ${optStyle}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-md border flex items-center justify-center text-xs font-mono font-bold ${
                        isSelected
                          ? "bg-scholar-emerald text-slate-950 border-scholar-emerald"
                          : "border-slate-300 dark:border-slate-700 text-slate-500"
                      }`}>
                        {opt.id}
                      </span>
                      <span className="text-sm leading-relaxed">{opt.text}</span>
                    </div>

                    {isPracticeChecked && (
                      <div>
                        {isPracticeCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                        {isPracticeWrong && <XCircle className="w-5 h-5 text-red-500" />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Practice Mode: Check Answer & Explanation Reveal */}
            {mode === "practice" && (
              <div className="pt-2">
                {!activePracticeReview ? (
                  <button
                    type="button"
                    onClick={() => handleCheckPracticeAnswer(activeQuestion.id)}
                    disabled={!selectedAnswers[activeQuestion.id] || gradingLoading}
                    className="px-4 py-2 bg-slate-900 dark:bg-midnight-800 text-white dark:text-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-800 dark:hover:bg-midnight-700 disabled:opacity-40 transition border border-slate-700 flex items-center gap-2"
                  >
                    {gradingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCheck className="w-3.5 h-3.5" />}
                    <span>Check Answer & View Explanation</span>
                  </button>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-midnight-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
                    <span className="font-mono uppercase tracking-wider font-semibold text-scholar-emerald flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      Pedagogical Explanation:
                    </span>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                      {activePracticeReview.explanation}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Navigation & Submit Bar */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-midnight-950 disabled:opacity-30 transition flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous Item</span>
              </button>

              <div className="flex items-center gap-3">
                {currentIndex < quiz.questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentIndex((prev) => prev + 1)}
                    className="px-5 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-semibold hover:bg-slate-800 dark:hover:bg-white transition flex items-center gap-1.5"
                  >
                    <span>Next Item</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : mode === "examination" ? (
                  <button
                    onClick={handleSubmitExamination}
                    disabled={gradingLoading}
                    className="px-6 py-2 bg-scholar-emerald hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-2"
                  >
                    {gradingLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Evaluating...</span>
                      </>
                    ) : (
                      <>
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>Submit Examination</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleSubmitExamination}
                    disabled={gradingLoading}
                    className="px-6 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold transition flex items-center gap-2"
                  >
                    <span>Complete Practice</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Post-Assessment Evaluation & Review Screen */}
      {attemptResult && quiz && (
        <div className="space-y-6">
          {/* Certificate / Result Header */}
          <div className="bg-white dark:bg-midnight-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-scholar-emerald font-semibold">
                  Evaluation Report • {mode === "examination" ? "Formal Exam" : "Practice Session"}
                </span>
                <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mt-1">
                  {quiz.title}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Completed in {formatTime(secondsElapsed)} • Evaluated server-side against canonical keys
                </p>
              </div>

              {/* Grade Badge */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-midnight-950 border border-slate-200 dark:border-slate-800 text-right min-w-[140px]">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  Final Score
                </div>
                <div className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {attemptResult.score} / {attemptResult.total_questions}
                </div>
                <div className="text-xs font-mono font-semibold text-scholar-emerald">
                  {attemptResult.percentage}% Mastery
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-midnight-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-mono text-slate-400 uppercase">Correct Answers</span>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {attemptResult.score} Items
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-midnight-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-mono text-slate-400 uppercase">Incorrect Items</span>
                <div className="text-lg font-bold text-red-500 mt-1">
                  {attemptResult.total_questions - attemptResult.score} Items
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-midnight-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-mono text-slate-400 uppercase">Academic Standing</span>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">
                  {attemptResult.percentage >= 85
                    ? "Distinction"
                    : attemptResult.percentage >= 70
                    ? "Commendable"
                    : "Revision Recommended"}
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-1.5">
                {(["all", "incorrect", "correct"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setReviewFilter(filter)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono capitalize transition ${
                      reviewFilter === filter
                        ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold"
                        : "bg-slate-100 dark:bg-midnight-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              <button
                onClick={handleResetQuiz}
                className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-semibold hover:bg-slate-800 dark:hover:bg-white transition flex items-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>New Assessment</span>
              </button>
            </div>
          </div>

          {/* Detailed Question Derivation List */}
          <div className="space-y-4">
            {quiz.questions
              .map((q, idx) => {
                const review = attemptResult.reviews.find((r) => r.question_id === q.id);
                const isCorrect = review?.is_correct ?? false;
                return { question: q, index: idx, review, isCorrect };
              })
              .filter(({ isCorrect }) => {
                if (reviewFilter === "correct") return isCorrect;
                if (reviewFilter === "incorrect") return !isCorrect;
                return true;
              })
              .map(({ question, index, review, isCorrect }) => (
                <div
                  key={question.id}
                  className={`bg-white dark:bg-midnight-900 border rounded-2xl p-6 md:p-7 space-y-4 shadow-sm transition ${
                    isCorrect
                      ? "border-emerald-500/30 dark:border-emerald-500/20"
                      : "border-red-500/30 dark:border-red-500/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        Question {index + 1}
                      </span>
                      <h3 className="text-base font-serif font-semibold text-slate-900 dark:text-slate-100">
                        {question.question}
                      </h3>
                    </div>

                    <span className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold flex items-center gap-1.5 ${
                      isCorrect
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                    }`}>
                      {isCorrect ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Correct</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Incorrect</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Options with Status */}
                  <div className="space-y-2 pt-1">
                    {question.options.map((opt) => {
                      const wasSelected = review?.selected_option_id === opt.id;
                      const isCanonicalCorrect = review?.correct_option_id === opt.id;

                      let style = "bg-slate-50 dark:bg-midnight-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400";
                      if (isCanonicalCorrect) {
                        style = "bg-emerald-500/10 border-emerald-500/40 text-emerald-900 dark:text-emerald-300 font-medium";
                      } else if (wasSelected && !isCanonicalCorrect) {
                        style = "bg-red-500/10 border-red-500/40 text-red-900 dark:text-red-300 line-through";
                      }

                      return (
                        <div
                          key={opt.id}
                          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${style}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono font-bold">{opt.id}.</span>
                            <span>{opt.text}</span>
                          </div>
                          {isCanonicalCorrect && (
                            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold uppercase">
                              Canonical Answer
                            </span>
                          )}
                          {wasSelected && !isCanonicalCorrect && (
                            <span className="text-[10px] font-mono text-red-500 font-semibold uppercase">
                              Your Answer
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation Derivation */}
                  {review?.explanation && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-midnight-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                      <span className="font-mono uppercase tracking-wider font-semibold text-scholar-emerald">
                        Derivation & Analysis:
                      </span>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        {review.explanation}
                      </p>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

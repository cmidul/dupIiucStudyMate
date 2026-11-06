"use client";

import React, { useState, useEffect } from "react";
import {
  Award,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Loader2,
  RotateCcw,
  Clock,
  Flag,
  BookOpen,
  FileCheck,
  AlertCircle,
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
  const [practiceReviews, setPracticeReviews] = useState<
    Record<string, { is_correct: boolean; correct_option_id: string; explanation: string }>
  >({});

  // Timer state for Exam Mode
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  const [loading, setLoading] = useState(false);
  const [gradingLoading, setGradingLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState<"all" | "incorrect" | "correct">("all");

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
    if (attemptResult) return;
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
  const activePracticeReview = activeQuestion ? practiceReviews[activeQuestion.id] : undefined;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#2E333D] pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#E8EAF0] tracking-tight">
            Quizzes & Practice
          </h1>
          <p className="text-xs sm:text-sm text-[#A0A6B4] mt-0.5">
            Practice study topics interactively or test yourself with timed examinations.
          </p>
        </div>

        {/* Mode Selector */}
        {!quiz && (
          <div className="flex items-center gap-1.5 p-1 bg-[#1C1F26] border border-[#2E333D] rounded-full self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setMode("examination")}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition ${
                mode === "examination"
                  ? "bg-[#3B6CFF] text-white shadow-[0_0_10px_rgba(59,108,255,0.3)] font-semibold"
                  : "text-[#A0A6B4] hover:text-[#E8EAF0]"
              }`}
            >
              Examination Mode
            </button>
            <button
              type="button"
              onClick={() => setMode("practice")}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition ${
                mode === "practice"
                  ? "bg-[#3B6CFF] text-white shadow-[0_0_10px_rgba(59,108,255,0.3)] font-semibold"
                  : "text-[#A0A6B4] hover:text-[#E8EAF0]"
              }`}
            >
              Practice Mode
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 bg-[#FF5C6C]/10 border border-[#FF5C6C]/30 text-[#FF5C6C] rounded-2xl text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Generator Configuration Panel */}
      {!quiz && (
        <div className="bg-[#1C1F26] border border-[#2E333D] rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="space-y-2">
            <label
              htmlFor="quiz-topic"
              className="block text-xs font-mono uppercase tracking-wider text-[#3B6CFF] font-semibold"
            >
              Study Topic or Subject
            </label>
            <input
              id="quiz-topic"
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder="e.g. Discrete Mathematics: Graph Theory and Dijkstra's Algorithm"
              className="w-full px-4 py-3 text-sm bg-[#14161A] border border-[#2E333D] rounded-xl focus:border-[#3B6CFF] outline-none text-[#E8EAF0] placeholder:text-[#6B7280] transition"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[#A0A6B4] font-semibold mb-2">
                Difficulty Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["beginner", "intermediate", "advanced"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={`py-2 text-xs font-medium rounded-xl border transition capitalize ${
                      difficulty === d
                        ? "bg-[#3B6CFF] text-white border-[#3B6CFF] shadow-[0_0_10px_rgba(59,108,255,0.3)] font-semibold"
                        : "bg-[#14161A] border-[#2E333D] text-[#A0A6B4] hover:text-[#E8EAF0] hover:border-[#3B6CFF]/40"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="q-count"
                  className="text-xs font-mono uppercase tracking-wider text-[#A0A6B4] font-semibold"
                >
                  Number of Questions
                </label>
                <span className="text-xs font-mono font-bold text-[#3B6CFF]">
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
                className="w-full accent-[#3B6CFF] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-[#6B7280] mt-1">
                <span>3 (Brief)</span>
                <span>8 (Standard)</span>
                <span>15 (Comprehensive)</span>
              </div>
            </div>
          </div>

          {/* Mode Explanatory Banner */}
          <div className="p-4 rounded-xl bg-[#14161A] border border-[#2E333D] text-xs text-[#A0A6B4] space-y-1">
            <span className="font-semibold text-[#E8EAF0] flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#3B6CFF]" />
              {mode === "examination" ? "Formal Exam Mode" : "Interactive Practice Mode"}
            </span>
            <p className="leading-relaxed">
              {mode === "examination"
                ? "Timed simulation. Answer keys and derivations remain sealed on the server until final submission."
                : "Interactive study workflow. Immediate answers and full explanations are validated question-by-question."}
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="px-6 py-2.5 bg-[#3B6CFF] hover:bg-[#5A82FF] active:bg-[#2A55D9] disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition flex items-center gap-2 shadow-[0_0_15px_rgba(59,108,255,0.35)]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Assessment...</span>
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

      {/* Active Assessment Viewport */}
      {quiz && activeQuestion && !attemptResult && (
        <div className="space-y-6">
          {/* Top Status Bar: Topic, Timer & Progress */}
          <div className="bg-[#1C1F26] border border-[#2E333D] rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-[#14161A] text-[#A0A6B4] border border-[#2E333D]">
                    {quiz.difficulty}
                  </span>
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${
                      mode === "examination"
                        ? "bg-[#F5B84B]/10 text-[#F5B84B] border-[#F5B84B]/30"
                        : "bg-[#3DDC97]/10 text-[#3DDC97] border-[#3DDC97]/30"
                    }`}
                  >
                    {mode === "examination" ? "Examination" : "Practice"}
                  </span>
                </div>
                <h2 className="text-lg md:text-xl font-bold text-[#E8EAF0] mt-1">
                  {quiz.title}
                </h2>
              </div>

              {/* Timer in Exam Mode */}
              {mode === "examination" && (
                <div className="flex items-center gap-2 px-3.5 py-1.5 bg-[#14161A] border border-[#2E333D] rounded-xl text-[#E8EAF0] font-mono text-xs self-start sm:self-auto">
                  <Clock className="w-4 h-4 text-[#3B6CFF]" />
                  <span>Elapsed: {formatTime(secondsElapsed)}</span>
                </div>
              )}
            </div>

            {/* Question Navigation Palette */}
            <div className="pt-3 border-t border-[#262A33] flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {quiz.questions.map((q, idx) => {
                  const isCurrent = idx === currentIndex;
                  const isAnswered = selectedAnswers[q.id] !== undefined;
                  const isFlagged = flaggedQuestions[q.id];

                  let pillStyle = "bg-[#14161A] border-[#2E333D] text-[#A0A6B4]";
                  if (isCurrent) {
                    pillStyle =
                      "ring-2 ring-[#3B6CFF] font-bold border-[#3B6CFF] bg-[#3B6CFF]/20 text-white";
                  } else if (isAnswered) {
                    pillStyle =
                      "bg-[#3B6CFF]/10 border-[#3B6CFF]/30 text-[#3B6CFF] font-medium";
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={`relative w-8 h-8 rounded-lg border text-xs font-mono transition flex items-center justify-center ${pillStyle}`}
                    >
                      <span>{idx + 1}</span>
                      {isFlagged && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#F5B84B] rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="text-xs text-[#A0A6B4] font-mono">
                Answered: {Object.keys(selectedAnswers).length} / {quiz.questions.length}
              </div>
            </div>
          </div>

          {/* Question Card */}
          <div className="bg-[#1C1F26] border border-[#2E333D] rounded-2xl p-6 md:p-8 space-y-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-mono text-[#3B6CFF] font-semibold uppercase">
                  Question {currentIndex + 1} of {quiz.questions.length}
                </span>
                <div className="text-base md:text-lg font-medium text-[#E8EAF0] mt-2 leading-relaxed">
                  {activeQuestion.question}
                </div>
              </div>

              {mode === "examination" && (
                <button
                  type="button"
                  onClick={() => handleToggleFlag(activeQuestion.id)}
                  title={
                    flaggedQuestions[activeQuestion.id]
                      ? "Unflag question"
                      : "Flag for review"
                  }
                  className={`p-2 rounded-xl border transition ${
                    flaggedQuestions[activeQuestion.id]
                      ? "bg-[#F5B84B]/10 border-[#F5B84B]/30 text-[#F5B84B]"
                      : "bg-[#14161A] border-[#2E333D] text-[#6B7280] hover:text-[#E8EAF0]"
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
                const isPracticeCorrect =
                  isPracticeChecked && activePracticeReview.correct_option_id === opt.id;
                const isPracticeWrong =
                  isPracticeChecked && isSelected && !activePracticeReview.is_correct;

                let optStyle =
                  "bg-[#14161A] border-[#2E333D] text-[#E8EAF0] hover:border-[#3B6CFF]/40";
                if (isSelected && !isPracticeChecked) {
                  optStyle =
                    "bg-[#3B6CFF]/15 border-[#3B6CFF] text-white shadow-[0_0_10px_rgba(59,108,255,0.15)]";
                }
                if (isPracticeChecked) {
                  if (isPracticeCorrect) {
                    optStyle = "bg-[#3DDC97]/15 border-[#3DDC97] text-[#3DDC97] font-medium";
                  } else if (isPracticeWrong) {
                    optStyle = "bg-[#FF5C6C]/15 border-[#FF5C6C] text-[#FF5C6C]";
                  } else {
                    optStyle = "opacity-40 border-[#2E333D]";
                  }
                }

                return (
                  <div
                    key={opt.id}
                    onClick={() => handleSelectOption(activeQuestion.id, opt.id)}
                    className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition ${optStyle}`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 rounded-md border flex items-center justify-center text-xs font-mono font-bold ${
                          isSelected
                            ? "bg-[#3B6CFF] text-white border-[#3B6CFF]"
                            : "border-[#2E333D] text-[#A0A6B4]"
                        }`}
                      >
                        {opt.id}
                      </span>
                      <span className="text-sm leading-relaxed">{opt.text}</span>
                    </div>

                    {isPracticeChecked && (
                      <div>
                        {isPracticeCorrect && (
                          <CheckCircle2 className="w-5 h-5 text-[#3DDC97]" />
                        )}
                        {isPracticeWrong && (
                          <XCircle className="w-5 h-5 text-[#FF5C6C]" />
                        )}
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
                    className="px-4 py-2 bg-[#242832] text-[#E8EAF0] text-xs font-semibold rounded-xl hover:bg-[#2E333D] disabled:opacity-40 transition border border-[#2E333D] flex items-center gap-2"
                  >
                    {gradingLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileCheck className="w-3.5 h-3.5 text-[#3B6CFF]" />
                    )}
                    <span>Check Answer & View Explanation</span>
                  </button>
                ) : (
                  <div className="p-4 rounded-xl bg-[#14161A] border border-[#2E333D] text-xs space-y-1.5">
                    <span className="font-mono uppercase tracking-wider font-semibold text-[#3B6CFF] flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      Explanation:
                    </span>
                    <p className="text-[#E8EAF0] leading-relaxed">
                      {activePracticeReview.explanation}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Navigation & Submit Bar */}
            <div className="flex items-center justify-between pt-6 border-t border-[#262A33]">
              <button
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="px-4 py-2 border border-[#2E333D] rounded-xl text-xs font-semibold text-[#A0A6B4] hover:bg-[#242832] hover:text-[#E8EAF0] disabled:opacity-30 transition flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <div className="flex items-center gap-3">
                {currentIndex < quiz.questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentIndex((prev) => prev + 1)}
                    className="px-5 py-2 bg-[#242832] hover:bg-[#2E333D] text-[#E8EAF0] rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border border-[#2E333D]"
                  >
                    <span>Next</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : mode === "examination" ? (
                  <button
                    onClick={handleSubmitExamination}
                    disabled={gradingLoading}
                    className="px-6 py-2 bg-[#3B6CFF] hover:bg-[#5A82FF] active:bg-[#2A55D9] text-white rounded-xl text-xs font-bold transition shadow-[0_0_15px_rgba(59,108,255,0.35)] flex items-center gap-2"
                  >
                    {gradingLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Submitting...</span>
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
                    className="px-6 py-2 bg-[#3B6CFF] hover:bg-[#5A82FF] text-white rounded-xl text-xs font-bold transition flex items-center gap-2"
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
          <div className="bg-[#1C1F26] border border-[#2E333D] rounded-2xl p-6 md:p-8 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#262A33] pb-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#3B6CFF] font-semibold">
                  Evaluation Report • {mode === "examination" ? "Formal Exam" : "Practice Session"}
                </span>
                <h2 className="text-xl md:text-2xl font-bold text-[#E8EAF0] mt-1">
                  {quiz.title}
                </h2>
                <p className="text-xs text-[#A0A6B4] mt-1">
                  Completed in {formatTime(secondsElapsed)} • Evaluated server-side
                </p>
              </div>

              {/* Grade Badge */}
              <div className="p-4 rounded-2xl bg-[#14161A] border border-[#2E333D] text-right min-w-[140px]">
                <div className="text-[10px] font-mono text-[#A0A6B4] uppercase tracking-wider">
                  Final Score
                </div>
                <div className="text-2xl font-bold text-[#E8EAF0] mt-0.5">
                  {attemptResult.score} / {attemptResult.total_questions}
                </div>
                <div className="text-xs font-mono font-semibold text-[#3B6CFF]">
                  {attemptResult.percentage}% Score
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#14161A] border border-[#2E333D]">
                <span className="text-[10px] font-mono text-[#A0A6B4] uppercase">Correct</span>
                <div className="text-lg font-bold text-[#3DDC97] mt-1">
                  {attemptResult.score} Items
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#14161A] border border-[#2E333D]">
                <span className="text-[10px] font-mono text-[#A0A6B4] uppercase">Incorrect</span>
                <div className="text-lg font-bold text-[#FF5C6C] mt-1">
                  {attemptResult.total_questions - attemptResult.score} Items
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#14161A] border border-[#2E333D]">
                <span className="text-[10px] font-mono text-[#A0A6B4] uppercase">Performance</span>
                <div className="text-sm font-semibold text-[#E8EAF0] mt-1">
                  {attemptResult.percentage >= 85
                    ? "Excellent Mastery"
                    : attemptResult.percentage >= 70
                    ? "Good Understanding"
                    : "Review Recommended"}
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
                        ? "bg-[#3B6CFF] text-white font-semibold"
                        : "bg-[#14161A] text-[#A0A6B4] hover:text-[#E8EAF0]"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              <button
                onClick={handleResetQuiz}
                className="px-4 py-2 bg-[#242832] hover:bg-[#2E333D] text-[#E8EAF0] border border-[#2E333D] rounded-xl text-xs font-semibold transition flex items-center gap-2"
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
                  className={`bg-[#1C1F26] border rounded-2xl p-6 md:p-7 space-y-4 shadow-xl transition ${
                    isCorrect
                      ? "border-[#3DDC97]/30"
                      : "border-[#FF5C6C]/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#A0A6B4]">
                        Question {index + 1}
                      </span>
                      <h3 className="text-base font-semibold text-[#E8EAF0]">
                        {question.question}
                      </h3>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold flex items-center gap-1.5 ${
                        isCorrect
                          ? "bg-[#3DDC97]/10 text-[#3DDC97] border border-[#3DDC97]/20"
                          : "bg-[#FF5C6C]/10 text-[#FF5C6C] border border-[#FF5C6C]/20"
                      }`}
                    >
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

                      let style =
                        "bg-[#14161A] border-[#2E333D] text-[#A0A6B4]";
                      if (isCanonicalCorrect) {
                        style =
                          "bg-[#3DDC97]/15 border-[#3DDC97]/40 text-[#3DDC97] font-medium";
                      } else if (wasSelected && !isCanonicalCorrect) {
                        style =
                          "bg-[#FF5C6C]/15 border-[#FF5C6C]/40 text-[#FF5C6C] line-through";
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
                            <span className="text-[10px] font-mono text-[#3DDC97] font-semibold uppercase">
                              Correct Answer
                            </span>
                          )}
                          {wasSelected && !isCanonicalCorrect && (
                            <span className="text-[10px] font-mono text-[#FF5C6C] font-semibold uppercase">
                              Your Answer
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation Derivation */}
                  {review?.explanation && (
                    <div className="p-4 rounded-xl bg-[#14161A] border border-[#2E333D] text-xs space-y-1">
                      <span className="font-mono uppercase tracking-wider font-semibold text-[#3B6CFF]">
                        Analysis:
                      </span>
                      <p className="text-[#E8EAF0] leading-relaxed">
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

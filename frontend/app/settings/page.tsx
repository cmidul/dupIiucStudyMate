"use client";

import React, { useEffect, useState } from "react";
import {
  Settings,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Unlink,
  Loader2,
  User as UserIcon,
  Sliders,
  Check,
  Save,
  Cpu,
  Sparkles,
  Key,
  Eye,
  EyeOff,
} from "lucide-react";
import { api, TelegramStatus, TelegramLinkToken, User, AIStatusResponse } from "@/lib/api";

interface LearningPreferences {
  explanationDepth: "concise" | "standard" | "detailed";
  answerStyle: "academic" | "conversational" | "exam_focused";
  defaultDifficulty: "beginner" | "intermediate" | "advanced";
  preferredLanguage: "english" | "bengali" | "auto";
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [linkToken, setLinkToken] = useState<TelegramLinkToken | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Learning preferences state
  const [preferences, setPreferences] = useState<LearningPreferences>({
    explanationDepth: "standard",
    answerStyle: "academic",
    defaultDifficulty: "intermediate",
    preferredLanguage: "auto",
  });
  const [prefSaved, setPrefSaved] = useState(false);

  // Auth form state if unauthenticated
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  // AI Provider & API Key state
  const [aiStatus, setAiStatus] = useState<AIStatusResponse | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>("gemini");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);

  useEffect(() => {
    loadUser();
    loadPreferences();
    loadAIStatus();
  }, []);

  async function loadAIStatus() {
    try {
      const res = await api.getAIStatus();
      setAiStatus(res);
      setSelectedProvider(res.active_provider);
    } catch {
      // ignore
    }
  }

  const handleConfigureAI = async (provider: string, key?: string) => {
    setAiSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await api.configureAI({ provider, api_key: key });
      setSuccessMsg(res.message);
      const updated = await api.getAIStatus();
      setAiStatus(updated);
      setSelectedProvider(updated.active_provider);
      setApiKeyInput("");
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || "Failed to configure AI engine.");
    } finally {
      setAiSaving(false);
    }
  };

  function loadPreferences() {
    try {
      const saved = localStorage.getItem("studymate_learning_preferences");
      if (saved) {
        setPreferences(JSON.parse(saved));
      }
    } catch {
      // use defaults
    }
  }

  const handleSavePreferences = () => {
    localStorage.setItem("studymate_learning_preferences", JSON.stringify(preferences));
    setPrefSaved(true);
    setTimeout(() => setPrefSaved(false), 2500);
  };

  async function loadUser() {
    try {
      const u = await api.getMe();
      setUser(u);
      const s = await api.getTelegramStatus();
      setTelegramStatus(s);
    } catch {
      setUser(null);
      setTelegramStatus(null);
    }
  }

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      if (isRegistering) {
        await api.register({ email, password, name });
        await api.login({ email, password });
      } else {
        await api.login({ email, password });
      }
      loadUser();
      setSuccessMsg(isRegistering ? "Account created successfully." : "Signed in successfully.");
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setTelegramStatus(null);
    setLinkToken(null);
    setSuccessMsg("Logged out.");
  };

  const handleGenerateToken = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const tok = await api.createLinkToken();
      setLinkToken(tok);
      setSuccessMsg("Telegram deep link generated. Click the link to open Telegram.");
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || "Failed to generate linking token.");
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm("Are you sure you want to disconnect your Telegram account?")) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      await api.unlinkTelegram();
      setLinkToken(null);
      setSuccessMsg("Telegram account unlinked successfully.");
      loadUser();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || "Failed to unlink account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-[#2E333D] pb-5">
        <h1 className="text-xl sm:text-2xl font-bold text-[#E8EAF0] tracking-tight">
          Settings & Account
        </h1>
        <p className="text-xs sm:text-sm text-[#A0A6B4] mt-0.5">
          Manage your learning preferences, AI backend, account, and Telegram synchronization.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-[#FF5C6C]/10 border border-[#FF5C6C]/30 text-[#FF5C6C] rounded-2xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-[#3DDC97]/10 border border-[#3DDC97]/30 text-[#3DDC97] rounded-2xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8">
        {/* Section 1: Learning Preferences */}
        <div className="bg-[#1C1F26] border border-[#2E333D] rounded-2xl p-6 md:p-8 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#262A33] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#14161A] border border-[#2E333D] flex items-center justify-center text-[#3B6CFF]">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#E8EAF0]">
                  Study & Reasoning Preferences
                </h2>
                <p className="text-xs text-[#A0A6B4]">
                  Customize explanation depth, default difficulty, and answer formatting.
                </p>
              </div>
            </div>

            <button
              onClick={handleSavePreferences}
              className="px-3.5 py-1.5 bg-[#3B6CFF] hover:bg-[#5A82FF] active:bg-[#2A55D9] text-white text-xs font-semibold rounded-xl shadow-[0_0_10px_rgba(59,108,255,0.3)] transition flex items-center gap-1.5"
            >
              {prefSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              <span>{prefSaved ? "Saved" : "Save"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Explanation Depth */}
            <div className="space-y-2">
              <label className="block text-xs font-mono uppercase tracking-wider text-[#A0A6B4] font-semibold">
                Explanation Depth
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["concise", "standard", "detailed"] as const).map((depth) => (
                  <button
                    key={depth}
                    type="button"
                    onClick={() => setPreferences((p) => ({ ...p, explanationDepth: depth }))}
                    className={`py-2 text-xs font-mono rounded-xl border transition capitalize ${
                      preferences.explanationDepth === depth
                        ? "bg-[#3B6CFF] text-white border-[#3B6CFF] shadow-[0_0_10px_rgba(59,108,255,0.3)] font-semibold"
                        : "bg-[#14161A] border-[#2E333D] text-[#A0A6B4] hover:border-[#3B6CFF]/40 hover:text-[#E8EAF0]"
                    }`}
                  >
                    {depth}
                  </button>
                ))}
              </div>
            </div>

            {/* Answer Style */}
            <div className="space-y-2">
              <label className="block text-xs font-mono uppercase tracking-wider text-[#A0A6B4] font-semibold">
                Answer Style
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "academic", label: "Academic" },
                  { id: "conversational", label: "Dialogic" },
                  { id: "exam_focused", label: "Exam-Focused" },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setPreferences((p) => ({ ...p, answerStyle: s.id as any }))}
                    className={`py-2 text-xs font-mono rounded-xl border transition ${
                      preferences.answerStyle === s.id
                        ? "bg-[#3B6CFF] text-white border-[#3B6CFF] shadow-[0_0_10px_rgba(59,108,255,0.3)] font-semibold"
                        : "bg-[#14161A] border-[#2E333D] text-[#A0A6B4] hover:border-[#3B6CFF]/40 hover:text-[#E8EAF0]"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Default Difficulty */}
            <div className="space-y-2">
              <label className="block text-xs font-mono uppercase tracking-wider text-[#A0A6B4] font-semibold">
                Default Difficulty
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["beginner", "intermediate", "advanced"] as const).map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setPreferences((p) => ({ ...p, defaultDifficulty: diff }))}
                    className={`py-2 text-xs font-mono rounded-xl border transition capitalize ${
                      preferences.defaultDifficulty === diff
                        ? "bg-[#3B6CFF] text-white border-[#3B6CFF] shadow-[0_0_10px_rgba(59,108,255,0.3)] font-semibold"
                        : "bg-[#14161A] border-[#2E333D] text-[#A0A6B4] hover:border-[#3B6CFF]/40 hover:text-[#E8EAF0]"
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            {/* Language Preference */}
            <div className="space-y-2">
              <label className="block text-xs font-mono uppercase tracking-wider text-[#A0A6B4] font-semibold">
                Output Language
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "auto", label: "Auto" },
                  { id: "english", label: "English" },
                  { id: "bengali", label: "Bengali" },
                ].map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() =>
                      setPreferences((p) => ({ ...p, preferredLanguage: lang.id as any }))
                    }
                    className={`py-2 text-xs font-mono rounded-xl border transition ${
                      preferences.preferredLanguage === lang.id
                        ? "bg-[#3B6CFF] text-white border-[#3B6CFF] shadow-[0_0_10px_rgba(59,108,255,0.3)] font-semibold"
                        : "bg-[#14161A] border-[#2E333D] text-[#A0A6B4] hover:border-[#3B6CFF]/40 hover:text-[#E8EAF0]"
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: AI Provider & API Key Integration */}
        <div className="bg-[#1C1F26] border border-[#2E333D] rounded-2xl p-6 md:p-8 space-y-6 shadow-xl">
          <div className="flex items-center gap-2.5 border-b border-[#262A33] pb-4">
            <div className="w-8 h-8 rounded-xl bg-[#14161A] border border-[#2E333D] flex items-center justify-center text-[#3B6CFF]">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#E8EAF0]">
                AI Intelligence Engine & API Keys
              </h2>
              <p className="text-xs text-[#A0A6B4]">
                Choose the backend AI provider for question solving, synthesis, and vision.
              </p>
            </div>
          </div>

          {/* Provider Selection Tabs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: "mock",
                name: "Mock Engine",
                badge: "Offline / Fast",
                desc: "Deterministic test responses without external credentials.",
              },
              {
                id: "gemini",
                name: "Google Gemini",
                badge: "Multimodal Vision",
                desc: "Full multimodal reasoning and image text analysis.",
              },
              {
                id: "groq",
                name: "Groq Cloud",
                badge: "Ultra Low-Latency",
                desc: "High-speed text question answering.",
              },
            ].map((p) => {
              const isSelected = selectedProvider === p.id;
              const isCurrentActive = aiStatus?.active_provider === p.id;

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProvider(p.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                    isSelected
                      ? "bg-[#242832] border-[#3B6CFF] shadow-[0_0_12px_rgba(59,108,255,0.2)]"
                      : "bg-[#14161A] border-[#2E333D] hover:border-[#3B6CFF]/40"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-semibold text-xs text-[#E8EAF0]">
                        {p.name}
                      </span>
                      {isCurrentActive && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#3DDC97]/15 text-[#3DDC97] border border-[#3DDC97]/30">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-[#3B6CFF] mb-2">{p.badge}</div>
                    <p className="text-[11px] text-[#A0A6B4] leading-snug">
                      {p.desc}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-[#262A33] flex items-center justify-between text-[11px] font-mono">
                    <span className="text-[#6B7280]">
                      {p.id === "mock" ? "Offline" : aiStatus?.providers?.[p.id]?.model || "Ready"}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#3B6CFF]" />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Configuration Form for Selected Provider */}
          {selectedProvider !== "mock" && (
            <div className="p-4 rounded-xl bg-[#14161A] border border-[#2E333D] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold text-[#E8EAF0] flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-[#3B6CFF]" />
                    <span>
                      {selectedProvider === "gemini" ? "Google Gemini API Key" : "Groq Cloud API Key"}
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#A0A6B4] mt-0.5">
                    {selectedProvider === "gemini" ? (
                      <>
                        Get a free API key at{" "}
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#3B6CFF] underline hover:opacity-80"
                        >
                          Google AI Studio
                        </a>
                        .
                      </>
                    ) : (
                      <>
                        Get an API key at{" "}
                        <a
                          href="https://console.groq.com/keys"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#3B6CFF] underline hover:opacity-80"
                        >
                          Groq Console
                        </a>
                        .
                      </>
                    )}
                  </p>
                </div>

                {aiStatus?.providers?.[selectedProvider]?.configured && (
                  <span className="px-2 py-0.5 text-[11px] font-mono rounded bg-[#3DDC97]/15 text-[#3DDC97] border border-[#3DDC97]/30 self-start sm:self-auto">
                    Key Configured
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={
                      aiStatus?.providers?.[selectedProvider]?.configured
                        ? "Enter new API key to update..."
                        : selectedProvider === "gemini"
                        ? "AIzaSy..."
                        : "gsk_..."
                    }
                    className="w-full px-3 py-2 pr-10 text-xs bg-[#1C1F26] border border-[#2E333D] rounded-xl text-[#E8EAF0] placeholder:text-[#6B7280] focus:border-[#3B6CFF] outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A0A6B4] hover:text-[#E8EAF0]"
                    title={showApiKey ? "Hide key" : "Show key"}
                  >
                    {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleConfigureAI(selectedProvider, apiKeyInput || undefined)}
                  disabled={
                    aiSaving ||
                    (!apiKeyInput.trim() && !aiStatus?.providers?.[selectedProvider]?.configured)
                  }
                  className="px-4 py-2 bg-[#3B6CFF] hover:bg-[#5A82FF] active:bg-[#2A55D9] disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 flex-shrink-0 shadow-[0_0_12px_rgba(59,108,255,0.25)]"
                >
                  {aiSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Activate {selectedProvider === "gemini" ? "Gemini" : "Groq"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Telegram Account Synchronization */}
        <div className="bg-[#1C1F26] border border-[#2E333D] rounded-2xl p-6 md:p-8 space-y-6 shadow-xl">
          <div className="flex items-center gap-2.5 border-b border-[#262A33] pb-4">
            <div className="w-8 h-8 rounded-xl bg-[#14161A] border border-[#2E333D] flex items-center justify-center text-[#3B6CFF]">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#E8EAF0]">
                Telegram Bot Synchronization
              </h2>
              <p className="text-xs text-[#A0A6B4]">
                Link your Telegram account to sync questions, answers, and study history.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#14161A] border border-[#2E333D]">
            <div>
              <div className="text-xs font-mono font-semibold text-[#E8EAF0] flex items-center gap-2">
                <span>Account Status:</span>
                {telegramStatus?.is_linked ? (
                  <span className="text-[#3DDC97] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Linked (ID: {telegramStatus.telegram_id})</span>
                  </span>
                ) : (
                  <span className="text-[#6B7280] font-normal">Not Connected</span>
                )}
              </div>
              <p className="text-[11px] text-[#A0A6B4] mt-1">
                Study questions submitted to @StudyMate_Bot sync automatically to your web account.
              </p>
            </div>

            {telegramStatus?.is_linked ? (
              <button
                onClick={handleUnlink}
                disabled={loading}
                className="px-3.5 py-1.5 border border-[#FF5C6C]/30 text-[#FF5C6C] hover:bg-[#FF5C6C]/10 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            ) : (
              <button
                onClick={handleGenerateToken}
                disabled={loading}
                className="px-4 py-2 bg-[#3B6CFF] hover:bg-[#5A82FF] active:bg-[#2A55D9] text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5 self-start sm:self-auto shadow-[0_0_12px_rgba(59,108,255,0.25)]"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Connect Telegram</span>
              </button>
            )}
          </div>

          {linkToken && (
            <div className="p-4 rounded-xl bg-[#3B6CFF]/10 border border-[#3B6CFF]/30 text-xs space-y-2">
              <span className="font-semibold text-[#3B6CFF]">
                Authorization Token Generated
              </span>
              <p className="text-[#A0A6B4]">
                Click below to open Telegram and confirm your single-use connection token (expires in {Math.round(linkToken.expires_in_seconds / 60)} minutes).
              </p>
              <div className="pt-1">
                <a
                  href={linkToken.deep_link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#3B6CFF] hover:bg-[#5A82FF] text-white font-semibold rounded-xl transition shadow-[0_0_12px_rgba(59,108,255,0.3)]"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Launch @StudyMate_Bot</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Identity & Authentication */}
        <div className="bg-[#1C1F26] border border-[#2E333D] rounded-2xl p-6 md:p-8 space-y-6 shadow-xl">
          <div className="flex items-center gap-2.5 border-b border-[#262A33] pb-4">
            <div className="w-8 h-8 rounded-xl bg-[#14161A] border border-[#2E333D] flex items-center justify-center text-[#3B6CFF]">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#E8EAF0]">
                User Account
              </h2>
              <p className="text-xs text-[#A0A6B4]">
                {user ? "Currently signed in." : "Sign in or register for persistent history and cross-platform sync."}
              </p>
            </div>
          </div>

          {user ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#14161A] border border-[#2E333D]">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-[#E8EAF0]">
                  {user.name || "Student / Scholar"}
                </div>
                <div className="text-xs font-mono text-[#A0A6B4]">{user.email}</div>
              </div>
              <button
                onClick={handleLogout}
                className="px-3.5 py-1.5 border border-[#2E333D] text-[#A0A6B4] hover:text-[#FF5C6C] hover:bg-[#242832] rounded-xl text-xs font-semibold transition self-start sm:self-auto"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <form onSubmit={handleAuthSubmit} className="space-y-4 max-w-md">
              {isRegistering && (
                <div>
                  <label className="block text-xs font-mono text-[#A0A6B4] mb-1">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs bg-[#14161A] border border-[#2E333D] rounded-xl text-[#E8EAF0] focus:border-[#3B6CFF] outline-none"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-mono text-[#A0A6B4] mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-[#14161A] border border-[#2E333D] rounded-xl text-[#E8EAF0] focus:border-[#3B6CFF] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-[#A0A6B4] mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-[#14161A] border border-[#2E333D] rounded-xl text-[#E8EAF0] focus:border-[#3B6CFF] outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setIsRegistering(!isRegistering)}
                  className="text-xs text-[#A0A6B4] hover:text-[#E8EAF0] transition"
                >
                  {isRegistering ? "Existing account? Sign in" : "Need an account? Register"}
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-[#3B6CFF] hover:bg-[#5A82FF] active:bg-[#2A55D9] text-white text-xs font-semibold rounded-xl transition shadow-[0_0_12px_rgba(59,108,255,0.25)]"
                >
                  {loading ? "Processing..." : isRegistering ? "Register" : "Sign In"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

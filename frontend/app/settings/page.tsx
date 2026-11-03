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
  Lock,
  User as UserIcon,
  Moon,
  Sun,
  Sliders,
  BookOpen,
  Check,
  Save,
} from "lucide-react";
import { api, TelegramStatus, TelegramLinkToken, User } from "@/lib/api";
import { useTheme } from "@/components/ThemeProvider";

interface LearningPreferences {
  explanationDepth: "concise" | "standard" | "detailed";
  answerStyle: "academic" | "conversational" | "exam_focused";
  defaultDifficulty: "beginner" | "intermediate" | "advanced";
  preferredLanguage: "english" | "bengali" | "auto";
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

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

  useEffect(() => {
    loadUser();
    loadPreferences();
  }, []);

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
      setSuccessMsg("Deep link generated. Click the link to open Telegram.");
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
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8 w-full">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <span className="text-[11px] font-mono uppercase tracking-wider text-scholar-emerald font-semibold">
          Configuration & Accounts
        </span>
        <h1 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 dark:text-slate-100 mt-1">
          Workspace Settings
        </h1>
        <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configure personal study preferences, workspace appearance, and cross-platform synchronization.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8">
        {/* Section 1: Learning Preferences */}
        <div className="bg-white dark:bg-midnight-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-midnight-800 flex items-center justify-center text-scholar-emerald">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-serif font-semibold text-slate-900 dark:text-slate-100">
                  Pedagogical & Reasoning Preferences
                </h2>
                <p className="text-xs text-slate-400">
                  Customize the default rigor, depth, and presentation style for the Solve Questions engine.
                </p>
              </div>
            </div>

            <button
              onClick={handleSavePreferences}
              className="px-3.5 py-1.5 bg-slate-900 dark:bg-scholar-emerald hover:bg-slate-800 dark:hover:bg-emerald-600 text-white dark:text-slate-950 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow-sm"
            >
              {prefSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              <span>{prefSaved ? "Saved" : "Save Preferences"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Explanation Depth */}
            <div className="space-y-2">
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 font-semibold">
                Explanation Depth
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["concise", "standard", "detailed"] as const).map((depth) => (
                  <button
                    key={depth}
                    type="button"
                    onClick={() => setPreferences((p) => ({ ...p, explanationDepth: depth }))}
                    className={`py-2 text-xs font-mono rounded-lg border transition capitalize ${
                      preferences.explanationDepth === depth
                        ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 font-semibold"
                        : "bg-slate-50 dark:bg-midnight-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    {depth}
                  </button>
                ))}
              </div>
            </div>

            {/* Answer Style */}
            <div className="space-y-2">
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 font-semibold">
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
                    className={`py-2 text-xs font-mono rounded-lg border transition ${
                      preferences.answerStyle === s.id
                        ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 font-semibold"
                        : "bg-slate-50 dark:bg-midnight-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Default Difficulty */}
            <div className="space-y-2">
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 font-semibold">
                Default Difficulty
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["beginner", "intermediate", "advanced"] as const).map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setPreferences((p) => ({ ...p, defaultDifficulty: diff }))}
                    className={`py-2 text-xs font-mono rounded-lg border transition capitalize ${
                      preferences.defaultDifficulty === diff
                        ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 font-semibold"
                        : "bg-slate-50 dark:bg-midnight-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            {/* Language Preference */}
            <div className="space-y-2">
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 font-semibold">
                Output Language
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "auto", label: "Auto Detect" },
                  { id: "english", label: "English" },
                  { id: "bengali", label: "Bengali" },
                ].map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => setPreferences((p) => ({ ...p, preferredLanguage: lang.id as any }))}
                    className={`py-2 text-xs font-mono rounded-lg border transition ${
                      preferences.preferredLanguage === lang.id
                        ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 font-semibold"
                        : "bg-slate-50 dark:bg-midnight-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Visual Theme & Appearance */}
        <div className="bg-white dark:bg-midnight-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-midnight-800 flex items-center justify-center text-scholar-emerald">
              {theme === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-base font-serif font-semibold text-slate-900 dark:text-slate-100">
                Visual Theme & Reading Mode
              </h2>
              <p className="text-xs text-slate-400">
                Choose between Midnight Blue dark academic mode and crisp paper-inspired light mode.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              onClick={() => setTheme("dark")}
              className={`p-4 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                theme === "dark"
                  ? "bg-midnight-950 border-scholar-emerald text-white"
                  : "bg-slate-50 dark:bg-midnight-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <Moon className="w-5 h-5 text-scholar-emerald" />
                <div>
                  <div className="text-xs font-semibold font-mono">Midnight Dark (Default)</div>
                  <div className="text-[11px] text-slate-400">Deep navy academic workspace</div>
                </div>
              </div>
              {theme === "dark" && <CheckCircle2 className="w-4 h-4 text-scholar-emerald" />}
            </div>

            <div
              onClick={() => setTheme("light")}
              className={`p-4 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                theme === "light"
                  ? "bg-white border-slate-900 text-slate-900 shadow-sm"
                  : "bg-slate-50 dark:bg-midnight-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <Sun className="w-5 h-5 text-amber-500" />
                <div>
                  <div className="text-xs font-semibold font-mono">Editorial Light</div>
                  <div className="text-[11px] text-slate-400">Clean parchment reading contrast</div>
                </div>
              </div>
              {theme === "light" && <CheckCircle2 className="w-4 h-4 text-slate-900" />}
            </div>
          </div>
        </div>

        {/* Section 3: Telegram Account Synchronization */}
        <div className="bg-white dark:bg-midnight-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-500">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-serif font-semibold text-slate-900 dark:text-slate-100">
                Telegram Cross-Platform Integration
              </h2>
              <p className="text-xs text-slate-400">
                Synchronize your learning workspace with the official Telegram study bot.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-midnight-950 border border-slate-200 dark:border-slate-800">
            <div>
              <div className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span>Account Status:</span>
                {telegramStatus?.is_linked ? (
                  <span className="text-scholar-emerald flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Synchronized (ID: {telegramStatus.telegram_id})</span>
                  </span>
                ) : (
                  <span className="text-slate-400 font-normal">Not Connected</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                When connected, questions and summaries generated on Telegram automatically sync to this web history.
              </p>
            </div>

            {telegramStatus?.is_linked ? (
              <button
                onClick={handleUnlink}
                disabled={loading}
                className="px-3.5 py-1.5 border border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            ) : (
              <button
                onClick={handleGenerateToken}
                disabled={loading}
                className="px-4 py-2 bg-slate-900 dark:bg-scholar-emerald hover:bg-slate-800 dark:hover:bg-emerald-600 text-white dark:text-slate-950 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 self-start sm:self-auto shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Connect Telegram</span>
              </button>
            )}
          </div>

          {linkToken && (
            <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs space-y-2">
              <span className="font-semibold text-sky-600 dark:text-sky-400">
                Telegram Link Authorization Ready
              </span>
              <p className="text-slate-600 dark:text-slate-300">
                Click below to launch Telegram and confirm synchronization. This single-use token expires in {Math.round(linkToken.expires_in_seconds / 60)} minutes.
              </p>
              <div className="pt-1">
                <a
                  href={linkToken.deep_link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Open @StudyMate_Bot</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Identity & Authentication */}
        <div className="bg-white dark:bg-midnight-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-midnight-800 flex items-center justify-center text-scholar-emerald">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-serif font-semibold text-slate-900 dark:text-slate-100">
                User Identity & Security
              </h2>
              <p className="text-xs text-slate-400">
                {user ? "Authenticated account details." : "Sign in or register for a persistent research profile."}
              </p>
            </div>
          </div>

          {user ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-midnight-950 border border-slate-200 dark:border-slate-800">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {user.name || "Academic Scholar"}
                </div>
                <div className="text-xs font-mono text-slate-400">{user.email}</div>
              </div>
              <button
                onClick={handleLogout}
                className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-midnight-800 rounded-lg text-xs font-semibold transition self-start sm:self-auto"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <form onSubmit={handleAuthSubmit} className="space-y-4 max-w-md">
              {isRegistering && (
                <div>
                  <label className="block text-xs font-mono text-slate-500 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-midnight-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-scholar-emerald"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-mono text-slate-500 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-midnight-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-scholar-emerald"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-500 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-midnight-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-scholar-emerald"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setIsRegistering(!isRegistering)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                >
                  {isRegistering ? "Existing account? Sign in" : "Need an account? Register"}
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-slate-900 dark:bg-scholar-emerald hover:bg-slate-800 dark:hover:bg-emerald-600 text-white dark:text-slate-950 text-xs font-semibold rounded-lg transition"
                >
                  {loading ? "Processing..." : isRegistering ? "Create Profile" : "Sign In"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

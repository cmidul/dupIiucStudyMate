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
} from "lucide-react";
import { api, TelegramStatus, TelegramLinkToken, User } from "@/lib/api";

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [linkToken, setLinkToken] = useState<TelegramLinkToken | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Auth form state if unauthenticated
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

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
  };

  const handleGenerateToken = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const tok = await api.createLinkToken();
      setLinkToken(tok);
      setSuccessMsg("Deep link generated! Click the link below to open Telegram and connect.");
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
    <div className="p-6 max-w-3xl mx-auto space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-600" />
          <span>Settings & Account Linking</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your account profile and connect your Telegram bot identity for shared history.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Account Profile or Sign In Box */}
      {user ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <UserIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">{user.name || "Student"}</h3>
                <p className="text-xs text-slate-400">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Sign Out
            </button>
          </div>
          <div className="text-xs text-slate-500">
            Account Status: <span className="font-semibold text-emerald-600">Active</span>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
          <h3 className="font-bold text-slate-800 text-base">
            {isRegistering ? "Create an Account" : "Sign in to StudyMate"}
          </h3>
          <p className="text-xs text-slate-500">
            Sign in to synchronize your learning history and connect your Telegram bot.
          </p>

          <form onSubmit={handleAuthSubmit} className="space-y-3">
            {isRegistering && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                required
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-xs text-indigo-600 hover:underline"
              >
                {isRegistering ? "Already have an account? Sign In" : "Need an account? Register"}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition"
              >
                {loading ? "Processing..." : isRegistering ? "Register" : "Sign In"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Telegram Account Linking Section (F-02, WEB-008) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">Telegram Integration</h3>
            <p className="text-xs text-slate-500">
              Link your Telegram account to chat, upload notes, and practice quizzes directly from Telegram.
            </p>
          </div>
        </div>

        {telegramStatus?.is_linked ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-emerald-800 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Connected to Telegram ID: {telegramStatus.telegram_id}</span>
            </div>
            <button
              onClick={handleUnlink}
              disabled={loading}
              className="px-3 py-1.5 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>Unlink Account</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Generate a single-use secure deep link to connect your Telegram account. Your link expires after 10 minutes.
            </p>

            {!linkToken ? (
              <button
                onClick={handleGenerateToken}
                disabled={loading || !user}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition flex items-center gap-2 shadow-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Link Telegram Account</span>
              </button>
            ) : (
              <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl space-y-3">
                <div className="text-xs font-semibold text-sky-900">
                  Click the link below or open your Telegram bot with this start command:
                </div>
                <a
                  href={linkToken.deep_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold transition shadow-sm"
                >
                  <span>Connect in Telegram App</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <p className="text-[11px] text-sky-700 font-mono">
                  Deep link: {linkToken.deep_link}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


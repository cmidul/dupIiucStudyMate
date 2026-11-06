"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus, Mail, Lock, User, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }
    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      await api.register({
        name: name.trim() || undefined,
        email: email.trim(),
        password,
      });
      await api.login({ email: email.trim(), password });
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || "Failed to register account. An account with this email may already exist.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="bg-[#1C1F26] border border-[#2E333D] rounded-2xl w-full max-w-md p-6 sm:p-8 space-y-6 shadow-xl">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#14161A] border border-[#2E333D] text-[#3B6CFF] mb-1">
            <UserPlus className="w-5 h-5" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#E8EAF0]">
            Create an Account
          </h1>
          <p className="text-xs text-[#A0A6B4] max-w-xs mx-auto">
            Sync study sessions across web and Telegram with personalized learning history.
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 bg-[#FF5C6C]/10 border border-[#FF5C6C]/30 text-[#FF5C6C] rounded-xl text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[#FF5C6C] flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-[#A0A6B4] mb-1 font-semibold">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ada Lovelace"
                className="w-full pl-10 pr-3 py-2.5 text-xs bg-[#14161A] border border-[#2E333D] rounded-xl text-[#E8EAF0] placeholder:text-[#6B7280] focus:border-[#3B6CFF] outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-[#A0A6B4] mb-1 font-semibold">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@example.com"
                required
                className="w-full pl-10 pr-3 py-2.5 text-xs bg-[#14161A] border border-[#2E333D] rounded-xl text-[#E8EAF0] placeholder:text-[#6B7280] focus:border-[#3B6CFF] outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-[#A0A6B4] mb-1 font-semibold">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                required
                className="w-full pl-10 pr-3 py-2.5 text-xs bg-[#14161A] border border-[#2E333D] rounded-xl text-[#E8EAF0] placeholder:text-[#6B7280] focus:border-[#3B6CFF] outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-[#A0A6B4] mb-1 font-semibold">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                required
                className="w-full pl-10 pr-3 py-2.5 text-xs bg-[#14161A] border border-[#2E333D] rounded-xl text-[#E8EAF0] placeholder:text-[#6B7280] focus:border-[#3B6CFF] outline-none transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-[#3B6CFF] hover:bg-[#5A82FF] active:bg-[#2A55D9] disabled:opacity-50 text-white font-semibold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(59,108,255,0.35)] mt-3"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Creating account...</span>
              </>
            ) : (
              <>
                <span>Create Account</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Footer Links */}
        <div className="pt-4 border-t border-[#262A33] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#A0A6B4]">
          <span>Already have an account?</span>
          <Link
            href="/login"
            className="text-[#3B6CFF] hover:underline font-semibold"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

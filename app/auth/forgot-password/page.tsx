"use client";

import { useState } from "react";
import Link from "next/link";
import AuthPageShell from "../../../components/auth/AuthPageShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.message || "Failed to send reset email.");
      return;
    }
    setSent(true);
  };

  return (
    <AuthPageShell>
      <div className="auth-card space-y-5">
        <div>
          <h1 className="auth-title">Reset password</h1>
          <p className="auth-sub">
            Enter your email and we&apos;ll send you a link to set a new password.
          </p>
        </div>
        {sent ? (
          <div className="rounded-[var(--radius-input)] border border-[var(--green)]/25 bg-[var(--green-light)] px-3 py-3 text-sm text-[var(--green-dark)] dark:border-emerald-800/40 dark:bg-emerald-950/35 dark:text-emerald-200">
            Check your email for the reset link. You can close this page.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="forgot-email" className="auth-label">
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
              />
            </div>
            {error && (
              <p className="rounded-[var(--radius-input)] border border-red-200/80 bg-[var(--red-light)] px-3 py-2 text-xs text-[var(--red-dark)] dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                {error}
              </p>
            )}
            <button type="submit" className="btn-primary inline-flex w-full justify-center py-2.5 text-sm" disabled={loading}>
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
        <p className="text-center text-xs text-text-muted">
          <Link href="/login" className="font-medium text-[var(--blue-600)] dark:text-[var(--blue-400)]">
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthPageShell>
  );
}

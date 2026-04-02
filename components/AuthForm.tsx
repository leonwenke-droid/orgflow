"use client";

import { useState } from "react";
import Link from "next/link";

export default function AuthForm({ redirectTo }: { redirectTo?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    setLoading(false);

    const data = await res.json().catch(() => ({} as Record<string, unknown>));

    if (!res.ok) {
      if (data.needsVerification) {
        const next = redirectTo || "/";
        window.location.href = `/claim-org/check-email?next=${encodeURIComponent(next)}`;
        return;
      }
      setError(
        data.detail ? `${data.message} (${data.detail})` : (data.message || "Login failed. Please check your credentials.")
      );
      return;
    }

    const fallback = redirectTo || "/dashboard";
    const directOrg =
      typeof data.defaultOrgDashboard === "string" && data.defaultOrgDashboard.startsWith("/")
        ? data.defaultOrgDashboard
        : null;
    const useHub =
      fallback === "/dashboard" || fallback.startsWith("/dashboard/");
    window.location.href = directOrg && useHub ? directOrg : fallback;
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="auth-email" className="auth-label">
          Email
        </label>
        <input
          id="auth-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="auth-input"
        />
      </div>
      <div>
        <label htmlFor="auth-password" className="auth-label">
          Password
        </label>
        <input
          id="auth-password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="auth-input"
        />
      </div>
      {error && (
        <p className="rounded-[var(--radius-input)] border border-red-200/80 bg-[var(--red-light)] px-3 py-2 text-xs text-[var(--red-dark)] dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary inline-flex w-full justify-center py-2.5 text-sm" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-xs text-text-muted">
        <Link
          href={redirectTo ? `/auth/forgot-password?redirectTo=${encodeURIComponent(redirectTo)}` : "/auth/forgot-password"}
          className="font-medium text-[var(--blue-600)] hover:text-[var(--blue-800)] dark:text-[var(--blue-400)] dark:hover:text-[var(--blue-200)]"
        >
          Forgot password?
        </Link>
      </p>
    </form>
  );
}

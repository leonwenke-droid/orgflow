"use client";

import { useState } from "react";
import Link from "next/link";

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
    <div className="mx-auto max-w-sm">
      <div className="card space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Reset password</h2>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            Enter your email and we&apos;ll send you a link to set a new password.
          </p>
        </div>
        {sent ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200">
            Check your email for the reset link. You can close this page.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3 text-sm">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border border-gray-300 bg-white p-2 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
            <button type="submit" className="btn-primary text-xs" disabled={loading}>
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
        <p className="text-xs text-gray-500">
          <Link href="/login" className="text-blue-600 hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}

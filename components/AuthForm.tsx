 "use client";

import { useState } from "react";
import Link from "next/link";

export default function AuthForm({ redirectTo }: { redirectTo?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
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

    if (mode === "signup") {
      const next = redirectTo || "/";
      window.location.href = `/claim-org/check-email?next=${encodeURIComponent(next)}`;
      return;
    }

    window.location.href = redirectTo || "/dashboard";
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 text-sm">
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-1">
        <button
          type="button"
          onClick={() => { setMode("signin"); setError(null); }}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold ${mode === "signin" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          disabled={loading}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => { setMode("signup"); setError(null); }}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold ${mode === "signup" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          disabled={loading}
        >
          Create account
        </button>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-700">
          Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-gray-300 bg-white p-2 text-xs"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-700">
          Password
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-gray-300 bg-white p-2 text-xs"
        />
      </div>
      {error && (
        <p className="text-xs text-red-600">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary text-xs" disabled={loading}>
        {loading ? (mode === "signup" ? "Creating…" : "Signing in…") : (mode === "signup" ? "Create account" : "Sign in")}
      </button>
      <p className="text-xs text-gray-500">
        <Link href={redirectTo ? `/auth/forgot-password?redirectTo=${encodeURIComponent(redirectTo)}` : "/auth/forgot-password"} className="text-blue-600 hover:underline">
          Forgot password?
        </Link>
      </p>
    </form>
  );
}


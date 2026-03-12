"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../../../lib/supabaseClient";

export default function LeadSetupClient({
  nextUrl,
  tokenHash: tokenHashProp,
  type: typeProp
}: {
  nextUrl: string;
  tokenHash?: string | null;
  type?: string | null;
}) {
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [status, setStatus] = useState<"checking" | "form" | "saving" | "error">("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      const supabase = createSupabaseBrowserClient();
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const hashParams = hash ? new URLSearchParams(hash.replace(/^#/, "")) : null;
      const accessToken = hashParams?.get("access_token") ?? null;
      const refreshToken = hashParams?.get("refresh_token") ?? null;
      const hasErrorInHash = hashParams?.get("error") ?? null;
      const tokenHash = tokenHashProp ?? (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token_hash") : null);
      const type = typeProp ?? (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("type") : null);

      if (hash && accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        if (cancelled) return;
        if (error) {
          setStatus("error");
          setErrorMessage(error.message);
          return;
        }
        if (typeof window !== "undefined") {
          window.history.replaceState({}, "", window.location.pathname + window.location.search);
        }
      } else if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as "invite" | "recovery" | "signup" | "email" | "magiclink"
        });
        if (cancelled) return;
        if (error) {
          setStatus("error");
          setErrorMessage(error.message);
          return;
        }
        if (typeof window !== "undefined") {
          const u = new URL(window.location.href);
          u.searchParams.delete("token_hash");
          u.searchParams.delete("type");
          window.history.replaceState({}, "", u.pathname + u.search);
        }
      }

      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        setStatus("error");
        setErrorMessage("The invite link is invalid or expired. Please request a new invitation.");
        return;
      }
      setStatus("form");
    }

    checkSession();
    return () => {
      cancelled = true;
    };
  }, [tokenHashProp, typeProp]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "saving") return;
    setErrorMessage(null);

    const pw = password.trim();
    const pw2 = passwordRepeat.trim();
    if (!pw || pw.length < 6) {
      setErrorMessage("Password muss mindestens 6 Zeichen lang sein.");
      return;
    }
    if (pw !== pw2) {
      setErrorMessage("The two passwords do not match.");
      return;
    }

    setStatus("saving");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) {
      setStatus("form");
      setErrorMessage(error.message);
      return;
    }

    window.location.replace(nextUrl || "/");
  }

  if (status === "checking") {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-sm text-blue-300">Einladung wird geprüft …</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-sm text-red-400">{errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-xl border border-blue-500/30 bg-card/80 p-6 shadow-lg">
      <h1 className="text-lg font-semibold text-blue-100">Set password</h1>
      <p className="mt-1 text-xs text-blue-300">
        Please set a password for your account. You will then be redirected to the admin dashboard.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-sm">
        <div>
          <label className="mb-1 block text-xs font-semibold text-blue-400">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-blue-500/30 bg-background px-2 py-1.5 text-xs text-blue-100"
            autoComplete="new-password"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-blue-400">Repeat password</label>
          <input
            type="password"
            value={passwordRepeat}
            onChange={(e) => setPasswordRepeat(e.target.value)}
            className="w-full rounded border border-blue-500/30 bg-background px-2 py-1.5 text-xs text-blue-100"
            autoComplete="new-password"
            required
          />
        </div>
        {errorMessage && <p className="text-xs text-red-400">{errorMessage}</p>}
        <button
          type="submit"
          disabled={status === "saving"}
          className="w-full rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {status === "saving" ? "Wird gespeichert …" : "Password speichern & weiter"}
        </button>
      </form>
    </div>
  );
}


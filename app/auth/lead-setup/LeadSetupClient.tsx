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
        setErrorMessage("Der Einladungslink ist ungültig oder abgelaufen. Bitte lass dir eine neue Einladung senden.");
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
      setErrorMessage("Passwort muss mindestens 6 Zeichen lang sein.");
      return;
    }
    if (pw !== pw2) {
      setErrorMessage("Die beiden Passwörter stimmen nicht überein.");
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
        <p className="text-sm text-cyan-300">Einladung wird geprüft …</p>
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
    <div className="mx-auto max-w-md rounded-xl border border-cyan-500/30 bg-card/80 p-6 shadow-lg">
      <h1 className="text-lg font-semibold text-cyan-100">Passwort festlegen</h1>
      <p className="mt-1 text-xs text-cyan-300">
        Bitte lege ein Passwort für deinen Zugang fest. Danach wirst du direkt zum Admin-Dashboard weitergeleitet.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-sm">
        <div>
          <label className="mb-1 block text-xs font-semibold text-cyan-400">Passwort</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-cyan-500/30 bg-background px-2 py-1.5 text-xs text-cyan-100"
            autoComplete="new-password"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-cyan-400">Passwort wiederholen</label>
          <input
            type="password"
            value={passwordRepeat}
            onChange={(e) => setPasswordRepeat(e.target.value)}
            className="w-full rounded border border-cyan-500/30 bg-background px-2 py-1.5 text-xs text-cyan-100"
            autoComplete="new-password"
            required
          />
        </div>
        {errorMessage && <p className="text-xs text-red-400">{errorMessage}</p>}
        <button
          type="submit"
          disabled={status === "saving"}
          className="w-full rounded bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-700 disabled:opacity-50"
        >
          {status === "saving" ? "Wird gespeichert …" : "Passwort speichern & weiter"}
        </button>
      </form>
    </div>
  );
}


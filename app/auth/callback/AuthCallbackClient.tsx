"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../../../lib/supabaseClient";

/**
 * Verarbeitet den Auth-Callback nach E-Mail-Verifizierung oder Einladung.
 * Liest token_hash/type aus der URL oder Tokens aus dem Hash, setzt die Session
 * und leitet zum zugehörigen Dashboard (next) weiter.
 */
export default function AuthCallbackClient({
  nextUrl,
  tokenHash,
  type,
  code
}: {
  nextUrl: string | null;
  tokenHash: string | null;
  type: string | null;
  code: string | null;
}) {
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = nextUrl && nextUrl.startsWith("/") ? nextUrl : "/";
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d8a4d5cc-1252-4b30-be66-acb41eda1386',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'595982'},body:JSON.stringify({sessionId:'595982',runId:'pre-fix',hypothesisId:'H10',location:'app/auth/callback/AuthCallbackClient.tsx:run:start',message:'Auth callback run start',data:{hasNextUrl:!!nextUrl,nextUrlLen:(nextUrl??'').length,redirectToLen:redirectTo.length,hasTokenHash:!!tokenHash,hasCode:!!code,type:type??null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      // 1) code in Query (PKCE-Flow)
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) {
          setErrorMessage(error.message);
          setStatus("error");
          return;
        }
        window.location.replace(redirectTo);
        return;
      }

      // 2) token_hash + type in Query (z. B. von Supabase Redirect)
      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          type: type as "invite" | "recovery" | "signup" | "email" | "magiclink",
          token_hash: tokenHash
        });
        if (cancelled) return;
        if (error) {
          setErrorMessage(error.message);
          setStatus("error");
          return;
        }
        // Bei Einladungen erst Passwort setzen lassen
        if (type === "invite") {
          const next = redirectTo && redirectTo.startsWith("/") ? redirectTo : "/";
          const leadSetupUrl = `/auth/lead-setup?next=${encodeURIComponent(next)}`;
          window.location.replace(leadSetupUrl);
        } else {
          window.location.replace(redirectTo);
        }
        return;
      }

      // 3) Tokens im Hash (Supabase leitet oft mit #access_token=... weiter)
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      if (hash) {
        const params = new URLSearchParams(hash.replace(/^#/, ""));
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          if (cancelled) return;
          if (error) {
            setErrorMessage(error.message);
            setStatus("error");
            return;
          }
          window.location.replace(redirectTo);
          return;
        }
      }

      // 4) Kein Token/Code – evtl. schon eingeloggt (Session von Supabase-Cookie), direkt weiterleiten
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) {
        window.location.replace(redirectTo);
        return;
      }

      setStatus("error");
      setErrorMessage("Anmeldung konnte nicht abgeschlossen werden. Bitte den Link aus der E-Mail erneut verwenden.");
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [tokenHash, type, code, nextUrl]);

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-sm text-blue-300">Signing in …</p>
        <p className="mt-2 text-xs text-blue-500">You will be redirected shortly.</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-sm text-red-400">{errorMessage}</p>
        {nextUrl && nextUrl.startsWith("/") && (
          <a
            href={nextUrl}
            className="mt-4 inline-block text-sm text-blue-400 underline hover:text-blue-300"
          >
            Trotzdem fortfahren
          </a>
        )}
      </div>
    );
  }

  return null;
}

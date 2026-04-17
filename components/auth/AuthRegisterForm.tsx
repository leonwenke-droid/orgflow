"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale } from "../LocaleProvider";
import { setPendingConsent } from "../ConsentSync";

export default function AuthRegisterForm({
  next
}: {
  /** Where to continue after email verification */
  next: string;
}) {
  const { locale } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accepted) {
      setError(locale === "de" ? "Bitte stimme Datenschutz & Bedingungen zu." : "Please accept Privacy & Terms.");
      return;
    }
    if (!password || password.length < 8) {
      setError(locale === "de" ? "Passwort mindestens 8 Zeichen." : "Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setPendingConsent({ consentType: "terms_privacy", consentValue: true, metadata: { source: "signup" } });
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, firstName, lastName, next })
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(data.message || (locale === "de" ? "Registrierung fehlgeschlagen." : "Registration failed."));
        setLoading(false);
        return;
      }
      window.location.href = `/claim-org/check-email?next=${encodeURIComponent(next)}`;
    } catch {
      setError(locale === "de" ? "Netzwerkfehler." : "Network error.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="auth-label" htmlFor="reg-first">
            {locale === "de" ? "Vorname" : "First name"}
          </label>
          <input
            id="reg-first"
            type="text"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="auth-input"
          />
        </div>
        <div>
          <label className="auth-label" htmlFor="reg-last">
            {locale === "de" ? "Nachname" : "Last name"}
          </label>
          <input
            id="reg-last"
            type="text"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="auth-input"
          />
        </div>
      </div>

      <div>
        <label htmlFor="reg-email" className="auth-label">
          Email
        </label>
        <input
          id="reg-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="auth-input"
        />
      </div>
      <div>
        <label htmlFor="reg-password" className="auth-label">
          {locale === "de" ? "Passwort" : "Password"}
        </label>
        <input
          id="reg-password"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="auth-input"
        />
        <p className="mt-1 text-[11px] text-text-muted">
          {locale === "de" ? "Mindestens 8 Zeichen." : "At least 8 characters."}
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-2 text-xs text-text-muted">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 rounded border-border-default"
        />
        <span>
          {locale === "de" ? (
            <>
              Ich stimme dem{" "}
              <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-text-primary">
                Datenschutzhinweis
              </Link>{" "}
              und den{" "}
              <Link href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-text-primary">
                Nutzungsbedingungen
              </Link>{" "}
              zu.
            </>
          ) : (
            <>
              I accept the{" "}
              <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-text-primary">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-text-primary">
                Terms of Use
              </Link>
              .
            </>
          )}
        </span>
      </label>

      {error ? (
        <p className="rounded-[var(--radius-input)] border border-red-200/80 bg-[var(--red-light)] px-3 py-2 text-xs text-[var(--red-dark)] dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn-primary inline-flex w-full justify-center py-2.5 text-sm" disabled={loading}>
        {loading ? (locale === "de" ? "Erstelle Konto…" : "Creating…") : (locale === "de" ? "Konto erstellen" : "Create account")}
      </button>
    </form>
  );
}


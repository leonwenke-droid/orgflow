"use client";

import { useState } from "react";
import { useLocale } from "../../../components/LocaleProvider";
import { t } from "../../../lib/i18n";

export default function InviteActivationClient({
  token,
  orgSlug,
  orgName,
  memberName,
  memberEmail,
  isAlreadySignedIn
}: {
  token: string;
  orgSlug: string;
  orgName: string;
  memberName: string;
  memberEmail: string;
  isAlreadySignedIn: boolean;
}) {
  const { locale } = useLocale();
  const [email, setEmail] = useState(memberEmail);
  const [fullName] = useState(memberName);
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError(t("invite.email_required", locale));
      return;
    }
    if (password.length < 8) {
      setError(t("invite.password_min", locale));
      return;
    }
    if (password !== passwordRepeat) {
      setError(t("invite.password_mismatch", locale));
      return;
    }
    if (!accepted) {
      setError(locale === "de" ? "Bitte stimme Datenschutz & Bedingungen zu." : "Please accept Privacy & Terms.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/member-invites/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, email: email.trim(), password, fullName, consentAccepted: true })
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok && !data.ok) {
      setError(data.message || t("invite.activation_failed", locale));
      return;
    }
    window.location.href = `/${encodeURIComponent(orgSlug)}/dashboard`;
  }

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-card-dark">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {t("invite.title", locale)}
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t("invite.subtitle", locale).replace("{orgName}", orgName)}
        </p>
      </div>

      {isAlreadySignedIn && (
        <p className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
          {t("invite.already_signed_in", locale)}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
            {t("invite.email", locale)}
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
            {t("invite.password", locale)}
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
            {t("invite.password_repeat", locale)}
          </label>
          <input
            type="password"
            required
            value={passwordRepeat}
            onChange={(e) => setPasswordRepeat(e.target.value)}
            className="w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <label className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            {locale === "de" ? "Ich stimme der " : "I agree to the "}
            <a className="underline" href="/privacy" target="_blank" rel="noreferrer">
              {locale === "de" ? "Datenschutzerklärung" : "Privacy Policy"}
            </a>
            {locale === "de" ? " und den " : " and the "}
            <a className="underline" href="/terms" target="_blank" rel="noreferrer">
              {locale === "de" ? "Nutzungsbedingungen" : "Terms"}
            </a>
            .
          </span>
        </label>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {loading ? t("invite.activating", locale) : t("invite.activate", locale)}
        </button>
      </form>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useLocale } from "../../../components/LocaleProvider";
import { t } from "../../../lib/i18n";

export default function PrivacyActions() {
  const { locale } = useLocale();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submitDeletionRequest() {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/me/deletion-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason })
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.message || "Request failed.");
      return;
    }
    setReason("");
    setMessage(locale === "de" ? "Anfrage wurde gesendet." : "Request sent.");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
        <p className="font-semibold text-gray-900 dark:text-gray-100">
          {locale === "de" ? "Auftragsverarbeitung (AVV)" : "Data processing (DPA)"}
        </p>
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
          {locale === "de"
            ? "AVV nach Art. 28 DSGVO auf Anfrage."
            : "DPA under Art. 28 GDPR available on request."}
        </p>
        <a className="mt-2 inline-block text-xs text-blue-600 underline hover:text-blue-700 dark:text-blue-400" href="/avv">
          {locale === "de" ? "Zur AVV-Seite" : "Open DPA page"}
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <a
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          href="/api/me/export"
        >
          {locale === "de" ? "Meine Daten exportieren" : "Export my data"}
        </a>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {locale === "de"
            ? "JSON-Export deiner Profildaten und Aktivitäten."
            : "JSON export of your profile and activity."}
        </span>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {locale === "de" ? "Löschanfrage" : "Deletion request"}
        </p>
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
          {locale === "de"
            ? "Sende eine Anfrage zur Kontolöschung. Ein Admin prüft und bestätigt die Löschung."
            : "Submit a request to delete your account. An admin will review and confirm."}
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="mt-3 w-full rounded border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          placeholder={locale === "de" ? "Optionaler Grund…" : "Optional reason…"}
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={submitDeletionRequest}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20"
          >
            {loading ? t("common.loading", locale) : (locale === "de" ? "Anfrage senden" : "Submit request")}
          </button>
          {message && <span className="text-xs text-gray-600 dark:text-gray-400">{message}</span>}
        </div>
      </div>
    </div>
  );
}


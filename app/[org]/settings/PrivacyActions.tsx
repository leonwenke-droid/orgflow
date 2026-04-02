"use client";

import { useState } from "react";
import { useLocale } from "../../../components/LocaleProvider";
import { t } from "../../../lib/i18n";
import { Button } from "../../../components/ui/Button";

export default function PrivacyActions({ orgSlug }: { orgSlug: string }) {
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
      <div className="rounded-lg border border-border-subtle bg-bg-secondary p-4 text-sm text-text-secondary dark:border-border-default dark:bg-bg-primary/50 dark:text-text-secondary">
        <p className="font-semibold text-text-primary dark:text-text-primary">
          {locale === "de" ? "Auftragsverarbeitung (AVV)" : "Data processing (DPA)"}
        </p>
        <p className="mt-1 text-xs text-text-secondary dark:text-text-muted">
          {locale === "de"
            ? "AVV nach Art. 28 DSGVO auf Anfrage."
            : "DPA under Art. 28 GDPR available on request."}
        </p>
        <a className="mt-2 inline-block text-xs text-blue-600 underline hover:text-blue-700 dark:text-blue-400" href={`/${orgSlug}/avv`}>
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
        <span className="text-xs text-text-secondary dark:text-text-muted">
          {locale === "de"
            ? "JSON-Export deiner Profildaten und Aktivitäten."
            : "JSON export of your profile and activity."}
        </span>
      </div>

      <div className="rounded-lg border border-border-subtle bg-bg-secondary p-4 dark:border-border-default dark:bg-bg-primary/50">
        <p className="text-sm font-semibold text-text-primary dark:text-text-primary">
          {locale === "de" ? "Löschanfrage" : "Deletion request"}
        </p>
        <p className="mt-1 text-xs text-text-secondary dark:text-text-muted">
          {locale === "de"
            ? "Sende eine Anfrage zur Kontolöschung. Ein Admin prüft und bestätigt die Löschung."
            : "Submit a request to delete your account. An admin will review and confirm."}
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="mt-3 w-full rounded border border-border-default bg-bg-primary p-2 text-sm dark:border-border-default dark:bg-bg-primary dark:text-text-primary"
          placeholder={locale === "de" ? "Optionaler Grund…" : "Optional reason…"}
        />
        <div className="mt-3 flex items-center gap-3">
          <Button type="button" variant="destructive" disabled={loading} onClick={submitDeletionRequest} className="text-sm font-semibold">
            {loading ? t("common.loading", locale) : locale === "de" ? "Anfrage senden" : "Submit request"}
          </Button>
          {message && <span className="text-xs text-text-secondary dark:text-text-muted">{message}</span>}
        </div>
      </div>
    </div>
  );
}


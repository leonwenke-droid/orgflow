"use client";

import { useState } from "react";
import { useLocale } from "../../../../components/LocaleProvider";
import { t } from "../../../../lib/i18n";
import { copyTextToClipboard } from "../../../../lib/clipboard";

export default function MembersExcelUpload({ orgSlug }: { orgSlug: string }) {
  const { locale } = useLocale();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [summary, setSummary] = useState<{ created: number; skipped: number; failed: number } | null>(null);
  const [issues, setIssues] = useState<Array<{ row?: number; name?: string; reason: string }>>([]);
  const [inviteLinks, setInviteLinks] = useState<{ fullName: string; inviteUrl: string; whatsappText: string }[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setMessage({ ok: false, text: "Please select a file." });
      return;
    }
    setLoading(true);
    setMessage(null);
    setSummary(null);
    setIssues([]);
    setInviteLinks([]);
    try {
      const formData = new FormData();
      formData.set("orgSlug", orgSlug);
      formData.set("file", file);
      const res = await fetch("/api/import-members", {
        method: "POST",
        body: formData
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: data.message || "Import fehlgeschlagen." });
        return;
      }
      setMessage({ ok: true, text: data.message || `${data.created} importiert.` });
      setSummary({
        created: Number(data.created ?? 0),
        skipped: Number(data.skipped ?? 0),
        failed: Number(data.failed ?? 0)
      });
      setIssues(Array.isArray(data.issues) ? data.issues : []);
      setFile(null);
      if (Array.isArray(data.inviteLinks) && data.inviteLinks.length > 0) {
        setInviteLinks(data.inviteLinks);
      } else {
        window.dispatchEvent(new PopStateEvent("popstate"));
        window.location.reload();
      }
    } catch (err) {
      setMessage({ ok: false, text: "Netzwerkfehler." });
    } finally {
      setLoading(false);
    }
  }

  async function copyAllLinks() {
    const text = inviteLinks.map((l) => `${l.fullName}: ${l.inviteUrl}`).join("\n");
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setMessage((m) => (m ? { ...m, text: m.text + " Links kopiert." } : null));
    }
  }

  function doneAndReload() {
    setInviteLinks([]);
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.location.reload();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <p className="w-full text-xs text-text-secondary dark:text-text-muted">
        {t("members.excel_formats_hint", locale)}
      </p>
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-sm text-text-secondary file:mr-2 file:rounded file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-white file:hover:bg-blue-700 dark:text-text-muted"
      />
      <button
        type="submit"
        disabled={loading || !file}
        className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? t("members.importing", locale) : t("members.import_btn", locale)}
      </button>
      {message && (
        <span className={message.ok ? "text-green-600" : "text-amber-600"}>
          {message.text}
        </span>
      )}
      {summary && (
        <div className="w-full rounded border border-border-subtle bg-bg-secondary p-2 text-xs text-text-secondary dark:border-border-default dark:bg-bg-primary dark:text-text-secondary">
          <span className="font-medium">Result:</span>{" "}
          created {summary.created} | skipped {summary.skipped} | failed {summary.failed}
        </div>
      )}
      {issues.length > 0 && (
        <div className="w-full rounded border border-[var(--color-warning)]/30 bg-[var(--bg-warning-subtle)] p-2 text-xs text-[var(--color-warning-text)]">
          <p className="font-medium">Import notes</p>
          <ul className="mt-1 max-h-32 list-disc overflow-y-auto pl-4">
            {issues.slice(0, 20).map((issue, idx) => (
              <li key={idx}>
                {issue.row ? `Row ${issue.row}` : issue.name ?? "Entry"}: {issue.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      {inviteLinks.length > 0 && (
        <div className="mt-3 w-full rounded border border-border-subtle bg-bg-secondary p-3 dark:border-border-default dark:bg-bg-primary">
          <p className="mb-2 text-sm font-medium text-text-secondary dark:text-text-secondary">
            {t("members.invite_links_export", locale)}
          </p>
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              onClick={copyAllLinks}
              className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
            >
              {t("members.copy_all_links", locale)}
            </button>
            <button
              type="button"
              onClick={doneAndReload}
              className="rounded border border-border-default bg-bg-primary px-2 py-1 text-xs dark:border-border-default dark:bg-bg-tertiary dark:text-text-primary"
            >
              {t("common.done", locale)}
            </button>
          </div>
          <ul className="max-h-40 overflow-y-auto text-xs text-text-secondary dark:text-text-muted">
            {inviteLinks.slice(0, 20).map((link, i) => (
              <li key={i} className="truncate">
                {link.fullName}: <a className="underline" href={link.inviteUrl} target="_blank" rel="noreferrer">{link.inviteUrl}</a>
              </li>
            ))}
            {inviteLinks.length > 20 && (
              <li>… +{inviteLinks.length - 20} {t("members.more", locale)}</li>
            )}
          </ul>
        </div>
      )}
    </form>
  );
}

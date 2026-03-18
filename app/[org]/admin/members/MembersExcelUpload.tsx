"use client";

import { useState } from "react";
import { t } from "../../../../lib/i18n";

export default function MembersExcelUpload({ orgSlug }: { orgSlug: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [inviteLinks, setInviteLinks] = useState<{ fullName: string; inviteUrl: string; whatsappText: string }[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setMessage({ ok: false, text: "Please select a file." });
      return;
    }
    setLoading(true);
    setMessage(null);
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

  function copyAllLinks() {
    const text = inviteLinks.map((l) => `${l.fullName}: ${l.inviteUrl}`).join("\n");
    void navigator.clipboard.writeText(text).then(() => setMessage((m) => (m ? { ...m, text: m.text + " Links kopiert." } : null)));
  }

  function doneAndReload() {
    setInviteLinks([]);
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.location.reload();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-sm text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-white file:hover:bg-blue-700 dark:text-gray-400"
      />
      <button
        type="submit"
        disabled={loading || !file}
        className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Importing…" : "Upload"}
      </button>
      {message && (
        <span className={message.ok ? "text-green-600" : "text-amber-600"}>
          {message.text}
        </span>
      )}
      {inviteLinks.length > 0 && (
        <div className="mt-3 w-full rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("members.invite_links_export")}
          </p>
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              onClick={copyAllLinks}
              className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
            >
              {t("members.copy_all_links")}
            </button>
            <button
              type="button"
              onClick={doneAndReload}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            >
              {t("common.done")}
            </button>
          </div>
          <ul className="max-h-40 overflow-y-auto text-xs text-gray-600 dark:text-gray-400">
            {inviteLinks.slice(0, 20).map((link, i) => (
              <li key={i} className="truncate">
                {link.fullName}: <a className="underline" href={link.inviteUrl} target="_blank" rel="noreferrer">{link.inviteUrl}</a>
              </li>
            ))}
            {inviteLinks.length > 20 && (
              <li>… +{inviteLinks.length - 20} {t("members.more")}</li>
            )}
          </ul>
        </div>
      )}
    </form>
  );
}

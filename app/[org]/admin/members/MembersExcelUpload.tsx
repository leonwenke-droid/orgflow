"use client";

import { useState } from "react";

export default function MembersExcelUpload({ orgSlug }: { orgSlug: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setMessage({ ok: false, text: "Bitte eine Datei wählen." });
      return;
    }
    setLoading(true);
    setMessage(null);
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
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.location.reload();
    } catch (err) {
      setMessage({ ok: false, text: "Netzwerkfehler." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-sm text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-white file:hover:bg-blue-700"
      />
      <button
        type="submit"
        disabled={loading || !file}
        className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Importiere…" : "Hochladen"}
      </button>
      {message && (
        <span className={message.ok ? "text-green-600" : "text-amber-600"}>
          {message.text}
        </span>
      )}
    </form>
  );
}

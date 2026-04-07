"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "./LocaleProvider";
import {
  addMemberUnavailabilityAction,
  deleteMemberUnavailabilityAction
} from "../app/[org]/me/unavailability-actions";

type Row = {
  id: string;
  unavailable_from: string;
  unavailable_until: string;
  reason: string | null;
};

export default function MemberUnavailabilitySection({
  orgSlug,
  rows
}: {
  orgSlug: string;
  rows: Row[];
}) {
  const { locale } = useLocale();
  const router = useRouter();
  const de = locale === "de";
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const fd = new FormData();
    fd.set("unavailable_from", from);
    fd.set("unavailable_until", until);
    fd.set("reason", reason);
    const res = await addMemberUnavailabilityAction(orgSlug, fd);
    setLoading(false);
    if (res.error) setMsg(res.error);
    else {
      setFrom("");
      setUntil("");
      setReason("");
      setMsg(de ? "Eingetragen." : "Saved.");
      router.refresh();
    }
  }

  async function remove(id: string) {
    if (!confirm(de ? "Eintrag löschen?" : "Remove this entry?")) return;
    setLoading(true);
    const res = await deleteMemberUnavailabilityAction(orgSlug, id);
    setLoading(false);
    if (res.error) setMsg(res.error);
    else router.refresh();
  }

  function fmt(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString(de ? "de-DE" : "en-GB", { dateStyle: "medium" });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary dark:text-text-muted">
        {de
          ? "Zeiträume, in denen du bei der Schicht-Rotation nicht eingeteilt werden solltest."
          : "Periods when you should be skipped for shift rotation."}
      </p>
      <form onSubmit={submit} className="space-y-3 rounded-lg border border-border-subtle bg-bg-secondary p-4 dark:border-border-default">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-text-secondary">{de ? "Von (Datum)" : "From"}</label>
            <input
              type="date"
              required
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-md border border-border-subtle bg-bg-primary px-2 py-1.5 text-sm"
              disabled={loading}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-secondary">{de ? "Bis (Datum)" : "Until"}</label>
            <input
              type="date"
              required
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className="w-full rounded-md border border-border-subtle bg-bg-primary px-2 py-1.5 text-sm"
              disabled={loading}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-text-secondary">{de ? "Grund (optional)" : "Reason (optional)"}</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border border-border-subtle bg-bg-primary px-2 py-1.5 text-sm"
            disabled={loading}
            placeholder={de ? "z. B. Urlaub" : "e.g. vacation"}
          />
        </div>
        <button type="submit" className="btn-secondary px-4 py-2 text-sm" disabled={loading}>
          {de ? "Speichern" : "Save"}
        </button>
      </form>
      {msg ? <p className="text-xs text-text-secondary">{msg}</p> : null}
      <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle dark:divide-border-default dark:border-border-default">
        {rows.length === 0 ? (
          <li className="p-3 text-sm text-text-secondary">{de ? "Keine Einträge." : "No entries."}</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 p-3 text-sm">
              <span>
                {fmt(r.unavailable_from)} – {fmt(r.unavailable_until)}
                {r.reason ? <span className="text-text-secondary"> — {r.reason}</span> : null}
              </span>
              <button
                type="button"
                className="text-xs text-red-600 hover:underline dark:text-red-400"
                onClick={() => void remove(r.id)}
                disabled={loading}
              >
                {de ? "Löschen" : "Remove"}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

"use client";

import { useState } from "react";
import { updateCommitteeNameAction, deleteCommitteeAction } from "./actions";

type Committee = { id: string; name: string };

export default function CommitteeRow({
  orgSlug,
  committee
}: {
  orgSlug: string;
  committee: Committee;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(committee.name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (name.trim() === committee.name) {
      setEditing(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { error: err } = await updateCommitteeNameAction(orgSlug, committee.id, name.trim());
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    setEditing(false);
    window.location.reload();
  }

  async function handleDelete() {
    if (!confirm(`Komitee „${committee.name}" wirklich löschen?`)) return;
    setLoading(true);
    setError(null);
    const { error: err } = await deleteCommitteeAction(orgSlug, committee.id);
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    window.location.reload();
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 text-sm">
      {editing ? (
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded border border-cyan-500/30 bg-background px-2 py-1 text-cyan-100"
          autoFocus
        />
      ) : (
        <span className="text-cyan-100">{committee.name}</span>
      )}
      <div className="flex items-center gap-1">
        {editing ? (
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="rounded bg-cyan-600 px-2 py-1 text-xs text-white hover:bg-cyan-700 disabled:opacity-50"
            >
              {loading ? "…" : "Speichern"}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setName(committee.name); setError(null); }}
              className="rounded border border-cyan-500/40 px-2 py-1 text-xs text-cyan-300 hover:bg-cyan-500/10"
            >
              Abbrechen
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded border border-cyan-500/40 px-2 py-1 text-xs text-cyan-400 hover:bg-cyan-500/10"
            >
              Bearbeiten
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="rounded border border-red-500/50 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
            >
              Löschen
            </button>
          </>
        )}
      </div>
      {error && <p className="w-full text-xs text-red-400">{error}</p>}
    </li>
  );
}

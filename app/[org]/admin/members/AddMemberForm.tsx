"use client";

import { useState } from "react";
import { addMemberAction } from "./actions";

type Committee = { id: string; name: string };

export default function AddMemberForm({
  orgSlug,
  committees
}: {
  orgSlug: string;
  committees: Committee[];
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [committeeIds, setCommitteeIds] = useState<Set<string>>(new Set());
  const [asLead, setAsLead] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const toggleCommittee = (id: string) => {
    setCommitteeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = fullName.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(false);
    const { error: err } = await addMemberAction(orgSlug, name, {
      email: email.trim() || undefined,
      committeeIds: Array.from(committeeIds),
      asLead
    });
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    setSuccess(true);
    setFullName("");
    setEmail("");
    setCommitteeIds(new Set());
    setAsLead(false);
    window.location.reload();
  };

  return (
    <div className="rounded-lg border border-cyan-500/30 bg-card p-4">
      <h2 className="text-sm font-semibold text-cyan-100">Add member manually</h2>
      <p className="mt-1 text-xs text-cyan-400/80">
        Name required, optional team. Email only for team lead. Member appears in the list immediately.
      </p>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3 text-sm">
        <div>
          <label className="mb-1 block text-xs font-semibold text-cyan-400">Name</label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Max Mustermann"
            className="w-full rounded border border-cyan-500/30 bg-card/60 p-2 text-xs text-cyan-100"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-cyan-300">
          <input
            type="checkbox"
            checked={asLead}
            onChange={(e) => setAsLead(e.target.checked)}
            className="rounded border-cyan-500/50"
          />
          Add as team lead
        </label>
        {asLead && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-cyan-400">Email (for team lead)</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="max@example.com"
              className="w-full rounded border border-cyan-500/30 bg-card/60 p-2 text-xs text-cyan-100"
            />
          </div>
        )}
        {committees.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-xs font-semibold text-cyan-400 hover:text-cyan-300">
              Teams ({committeeIds.size} selected) ▾
            </summary>
            <div className="mt-1 flex flex-wrap gap-2 rounded border border-cyan-500/30 bg-card/60 p-2">
              {committees.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-1.5 text-xs text-cyan-100">
                  <input type="checkbox" checked={committeeIds.has(c.id)} onChange={() => toggleCommittee(c.id)} className="rounded border-cyan-500/40" />
                  {c.name}
                </label>
              ))}
            </div>
          </details>
        )}
        {error && <p className="text-xs text-red-300">{error}</p>}
        {success && <p className="text-xs text-green-400">Member added.</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-700 disabled:opacity-50"
        >
          {loading ? "Adding…" : "Add member"}
        </button>
      </form>
    </div>
  );
}

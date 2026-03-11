"use client";

import { useState } from "react";
import { deleteOrganizationAction } from "./actions";

export default function DeleteOrgButton({
  orgId,
  orgName
}: {
  orgId: string;
  orgName: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await deleteOrganizationAction(orgId, orgName, confirmation);
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    setOpen(false);
    setConfirmation("");
    window.location.reload();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-md border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20"
      >
        Entfernen
      </button>
      {open && (
        <form
          onSubmit={handleSubmit}
          className="mt-3 rounded-lg border border-red-500/30 bg-card p-4"
        >
          <p className="text-sm font-medium text-cyan-100">
            Organisation wirklich entfernen?
          </p>
          <p className="mt-1 text-xs text-cyan-400/80">
            Zum Bestätigen bitte den exakten Organisationsnamen eingeben:{" "}
            <strong className="text-cyan-200">{orgName}</strong>
          </p>
          <input
            type="text"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder={orgName}
            className="mt-3 w-full rounded border border-cyan-500/30 bg-background px-3 py-2 text-sm text-cyan-100 placeholder:text-cyan-500/50"
          />
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={loading || confirmation.trim() !== orgName}
              className="rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "Wird entfernt…" : "Endgültig entfernen"}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setConfirmation(""); setError(null); }}
              className="rounded border border-cyan-500/40 px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-500/10"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}
    </>
  );
}

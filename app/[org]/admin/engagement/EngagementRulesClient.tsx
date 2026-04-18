"use client";

import { useMemo, useState } from "react";
import { updateEngagementWeightsAction } from "./actions";

export default function EngagementRulesClient({
  orgSlug,
  initialWeights,
}: {
  orgSlug: string;
  initialWeights: Record<string, number>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weights, setWeights] = useState<Record<string, number>>(() => ({ ...initialWeights }));

  const rows = useMemo(() => {
    const keys = Object.keys(weights);
    keys.sort();
    return keys.map((k) => ({ key: k, value: weights[k] ?? 0 }));
  }, [weights]);

  async function onSave() {
    setSaving(true);
    setError(null);
    const res = await updateEngagementWeightsAction(orgSlug, weights);
    setSaving(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setEditing(false);
  }

  return (
    <div className="card">
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="section-label">Punkte-Regelwerk</div>
          {!editing ? (
            <button type="button" className="btn-secondary" onClick={() => setEditing(true)}>
              Regeln bearbeiten
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={onSave} disabled={saving}>
              {saving ? "…" : "Save"}
            </button>
          )}
        </div>

        <div className="mt-3 divide-y divide-gray-100">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0 text-text-secondary">{r.key.replace(/_/g, " ")}</div>
              {editing ? (
                <input
                  type="number"
                  className="w-24 rounded-lg border border-border-subtle bg-bg-primary px-2 py-1 text-right text-sm"
                  value={r.value}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setWeights((prev) => ({ ...prev, [r.key]: Number.isFinite(v) ? v : 0 }));
                  }}
                />
              ) : (
                <div className="shrink-0 text-right font-medium text-text-primary">{r.value}</div>
              )}
            </div>
          ))}
        </div>

        {editing ? (
          <div className="mt-3">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setWeights({ ...initialWeights });
                setEditing(false);
                setError(null);
              }}
            >
              Abbrechen
            </button>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-danger-dark">{error}</p> : null}
      </div>
    </div>
  );
}


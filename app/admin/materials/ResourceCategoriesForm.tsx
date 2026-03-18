"use client";

import { useState } from "react";

type Category = { key: string; name: string; points: number; examples?: string | null };

export default function ResourceCategoriesForm({
  orgId,
  initial
}: {
  orgId: string;
  initial: Category[];
}) {
  const [cats, setCats] = useState<Category[]>(initial);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/resource-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, categories: cats })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.message || "Save failed.");
        setLoading(false);
        return;
      }
      setMessage("Saved.");
      setLoading(false);
    } catch {
      setMessage("Network error.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Resource categories</p>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            Configure labels and points per category (org-specific).
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {cats.map((c, idx) => (
          <div key={c.key} className="rounded border border-gray-200 p-3 text-xs dark:border-gray-700">
            <p className="font-semibold text-gray-700 dark:text-gray-200">{c.key}</p>
            <label className="mt-2 block text-[11px] text-gray-500 dark:text-gray-400">Name</label>
            <input
              value={c.name}
              onChange={(e) => {
                const next = [...cats];
                next[idx] = { ...c, name: e.target.value };
                setCats(next);
              }}
              className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            <label className="mt-2 block text-[11px] text-gray-500 dark:text-gray-400">Points</label>
            <input
              type="number"
              value={c.points}
              onChange={(e) => {
                const next = [...cats];
                next[idx] = { ...c, points: Number(e.target.value) };
                setCats(next);
              }}
              className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        ))}
      </div>

      {message && <p className="text-xs text-gray-600 dark:text-gray-400">{message}</p>}
    </div>
  );
}


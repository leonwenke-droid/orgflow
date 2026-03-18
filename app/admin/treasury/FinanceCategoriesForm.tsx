"use client";

import { useState } from "react";

type Category = { key: string; name: string };

export default function FinanceCategoriesForm({
  orgId,
  initial
}: {
  orgId: string;
  initial: Category[];
}) {
  const [cats, setCats] = useState<Category[]>(initial);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(next: Category[]) {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/finance-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, categories: next.map((c) => ({ ...c, enabled: true })) })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.message || "Save failed.");
        setLoading(false);
        return;
      }
      setCats(next);
      setMessage("Saved.");
      setLoading(false);
    } catch {
      setMessage("Network error.");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Categories</p>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Used for finance entries.</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {cats.map((c) => (
          <span key={c.key} className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-700 dark:border-gray-700 dark:text-gray-300">
            {c.name}
          </span>
        ))}
        {cats.length === 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">No categories yet.</span>
        )}
      </div>

      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const name = newName.trim();
          if (!name) return;
          const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || `cat-${Date.now()}`;
          save([...cats, { key, name }]);
          setNewName("");
        }}
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name"
          className="min-w-[220px] flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Saving…" : "Add"}
        </button>
      </form>

      {message && <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{message}</p>}
    </div>
  );
}


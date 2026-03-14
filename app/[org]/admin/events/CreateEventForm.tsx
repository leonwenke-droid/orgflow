"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateEventForm({ orgSlug, orgId }: { orgSlug: string; orgId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement)?.value?.trim();
    const startDate = (form.elements.namedItem("start_date") as HTMLInputElement)?.value?.trim() || null;
    const endDate = (form.elements.namedItem("end_date") as HTMLInputElement)?.value?.trim() || null;
    if (!name) {
      setLoading(false);
      return;
    }
    const slug = name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 50) || `event-${Date.now()}`;
    const res = await fetch("/api/events/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: orgId, name, slug, start_date: startDate || null, end_date: endDate || null }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.message || "Failed to create event.");
      return;
    }
    router.refresh();
    form.reset();
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1">
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">Event name</label>
        <input
          type="text"
          name="name"
          required
          placeholder="e.g. Summer Festival 2026"
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">Start date</label>
        <input
          type="date"
          name="start_date"
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">End date</label>
        <input
          type="date"
          name="end_date"
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
      <button type="submit" disabled={loading} className="btn-primary text-xs">
        {loading ? "Creating…" : "Create event"}
      </button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}

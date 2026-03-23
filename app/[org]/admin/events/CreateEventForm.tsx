"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useLocale } from "../../../../components/LocaleProvider";
import { t } from "../../../../lib/i18n";

export default function CreateEventForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const { locale } = useLocale();
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
      setError(t("events.error_name_required", locale));
      setLoading(false);
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setError(t("events.error_date_order", locale));
      setLoading(false);
      return;
    }
    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 50) || `event-${Date.now()}`;
    const res = await fetch("/api/events/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: orgId,
        name,
        slug,
        start_date: startDate || null,
        end_date: endDate || null
      })
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      const msg = String(data.message || "");
      if (msg.includes("End date must")) {
        setError(t("events.error_date_order", locale));
        return;
      }
      setError(msg || t("events.error_create", locale));
      return;
    }
    router.refresh();
    form.reset();
  };

  return (
    <div className="mt-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
            {t("events.form_name", locale)}
          </label>
          <input
            type="text"
            name="name"
            required
            placeholder={t("events.form_name_placeholder", locale)}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
            {t("events.form_start", locale)}
          </label>
          <input
            type="date"
            name="start_date"
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
            {t("events.form_end", locale)}
          </label>
          <input
            type="date"
            name="end_date"
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary inline-flex items-center gap-2 text-xs disabled:opacity-70"
          aria-busy={loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
              {t("events.form_creating", locale)}
            </>
          ) : (
            t("events.form_submit", locale)
          )}
        </button>
      </form>
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

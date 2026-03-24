"use client";

import { useState } from "react";
import { useLocale } from "../../../components/LocaleProvider";
import { t } from "../../../lib/i18n";
import { updateOrganizationAction } from "./actions";

export default function EditOrgForm({
  orgSlug,
  initialName,
  initialSlug,
  initialLogoUrl = ""
}: {
  orgSlug: string;
  initialName: string;
  initialSlug: string;
  initialLogoUrl?: string;
}) {
  const { locale } = useLocale();
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await updateOrganizationAction(orgSlug, { name, slug, logoUrl: logoUrl.trim() || null });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.error === undefined && slug === initialSlug) {
      window.location.reload();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-sm">
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
          {t("settings.org_name", locale)}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
          {t("settings.org_slug", locale)}
        </label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
          required
          placeholder="my-org"
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 font-mono text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
          URL will be /{slug || "…"}/…
        </p>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
          {t("settings.org_logo_url", locale)}
        </label>
        <input
          type="url"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://…"
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{t("settings.org_logo_hint", locale)}</p>
        {logoUrl.trim() ? (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[11px] text-gray-500 dark:text-gray-400">{t("settings.org_logo_preview", locale)}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl.trim()} alt="" className="h-8 w-8 rounded-md border border-gray-200 object-cover dark:border-gray-600" />
          </div>
        ) : null}
      </div>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-70 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        {loading ? t("common.loading", locale) : t("common.save", locale)}
      </button>
    </form>
  );
}

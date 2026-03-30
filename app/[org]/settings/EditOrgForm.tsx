"use client";

import { useRef, useState } from "react";
import { useLocale } from "../../../components/LocaleProvider";
import { t } from "../../../lib/i18n";
import { updateOrganizationAction, uploadOrgLogoAction } from "./actions";

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
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError(locale === "de" ? "Datei zu groß (max 2 MB)." : "File too large (max 2 MB).");
      return;
    }

    setPreview(URL.createObjectURL(file));
    setUploading(true);
    setError(null);

    const fd = new FormData();
    fd.set("logo", file);
    const result = await uploadOrgLogoAction(orgSlug, fd);
    setUploading(false);

    if (result.error) {
      setError(result.error);
      setPreview(null);
      return;
    }
    if (result.url) {
      setLogoUrl(result.url);
      setPreview(null);
    }
  }

  function handleRemoveLogo() {
    setLogoUrl("");
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const displayUrl = preview || (logoUrl.trim() || null);

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
          {locale === "de" ? "Logo" : "Logo"}
        </label>
        <div className="flex items-center gap-3">
          {displayUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={displayUrl} alt="" className="h-12 w-12 rounded-lg border border-gray-200 object-cover dark:border-gray-600" />
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                </div>
              )}
            </div>
          ) : null}
          <div className="flex flex-col gap-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="text-xs file:mr-2 file:rounded-lg file:border file:border-gray-200 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-50 dark:file:border-gray-600 dark:file:bg-gray-800 dark:file:text-gray-200"
            />
            <p className="text-[10px] text-gray-500">
              {locale === "de" ? "JPG, PNG oder WebP · max 2 MB" : "JPG, PNG or WebP · max 2 MB"}
            </p>
          </div>
          {logoUrl && (
            <button type="button" onClick={handleRemoveLogo} className="text-xs text-red-500 hover:underline">
              {locale === "de" ? "Entfernen" : "Remove"}
            </button>
          )}
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading || uploading}
        className="btn-primary disabled:opacity-70"
      >
        {loading ? t("common.loading", locale) : t("common.save", locale)}
      </button>
    </form>
  );
}

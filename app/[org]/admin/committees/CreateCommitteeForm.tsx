"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createCommitteeAction } from "./actions";
import Link from "next/link";
import { useLocale } from "../../../../components/LocaleProvider";
import { t } from "../../../../lib/i18n";

type Committee = { id: string; name: string };

export default function CreateCommitteeForm({
  orgSlug
}: {
  orgSlug: string;
  orgId: string;
  committees: Committee[];
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const [limitError, setLimitError] = useState<string | null>(null);
  const [otherError, setOtherError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setLimitError(null);
    setOtherError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = formData.get("name")?.toString()?.trim();
    if (!name) return;
    setSubmitting(true);
    const description = formData.get("description")?.toString()?.trim() || null;
    const isActive = formData.get("is_active") === "on";
    const result = await createCommitteeAction(orgSlug, {
      name,
      description,
      is_active: isActive
    });
    setSubmitting(false);
    if (result.errorKey) {
      setOtherError(t(result.errorKey, locale));
      return;
    }
    if (result.error) {
      if (result.error.includes("limit")) {
        setLimitError(result.error);
      } else {
        setOtherError(result.error);
      }
      return;
    }
    form.reset();
    const activeCb = form.querySelector<HTMLInputElement>('input[name="is_active"]');
    if (activeCb) activeCb.checked = true;
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
      {otherError && (
        <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--bg-danger-subtle)] p-4 text-sm text-[var(--color-danger-text)]">
          <p className="font-medium">{otherError}</p>
        </div>
      )}
      {limitError && (
        <div className="rounded-lg border border-[var(--color-warning)]/30 bg-[var(--bg-warning-subtle)] p-4 text-sm text-[var(--color-warning-text)]">
          <p className="font-medium">{limitError}</p>
          <Link href="/#pricing" className="mt-2 inline-block text-blue-600 underline hover:text-blue-700 dark:text-blue-400">
            View pricing & upgrade →
          </Link>
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <input
          type="text"
          name="name"
          placeholder={t("teams.name_placeholder", locale)}
          className="flex-1 rounded border border-border-default bg-bg-primary px-3 py-2 text-text-primary placeholder:text-text-muted dark:border-border-default dark:bg-bg-primary dark:text-text-primary dark:placeholder:text-text-muted"
          required
        />
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 sm:shrink-0"
        >
          {submitting ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
          {submitting ? t("tasks.saving", locale) : t("teams.create", locale)}
        </button>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-text-secondary dark:text-text-muted">
          {t("teams.description", locale)}
        </label>
        <textarea
          name="description"
          rows={2}
          placeholder={t("teams.description_placeholder", locale)}
          className="w-full rounded border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted dark:border-border-default dark:bg-bg-primary dark:text-text-primary"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-text-secondary dark:text-text-secondary">
        <input type="checkbox" name="is_active" defaultChecked className="rounded border-border-default" />
        {t("teams.active", locale)}
      </label>
    </form>
  );
}

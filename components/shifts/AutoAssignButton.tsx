"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "../LocaleProvider";
import { t, type Locale } from "../../lib/i18n";
import type {
  AssignAutoAssignForShiftResult,
  AutoAssignPreviewRow,
  PreviewAutoAssignForShiftResult
} from "../../types/autoAssign";

type Props = {
  shiftId: string;
  previewAutoAssignForShift: (shiftId: string) => Promise<PreviewAutoAssignForShiftResult>;
  assignAutoAssignForShift: (shiftId: string) => Promise<AssignAutoAssignForShiftResult>;
};

function formatScore(n: number, locale: Locale): string {
  const x = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(x);
}

function Spinner() {
  return (
    <span
      className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"
      aria-hidden
    />
  );
}

function statusKey(row: AutoAssignPreviewRow): string {
  if (row.blocked === "already_assigned") return "auto_assign.preview.status_blocked_already";
  if (row.blocked === "cooldown") return "auto_assign.preview.status_blocked_cooldown";
  if (row.blocked === "unavailable") return "auto_assign.preview.status_blocked_unavailable";
  return "auto_assign.preview.status_eligible";
}

export default function AutoAssignButton({ shiftId, previewAutoAssignForShift, assignAutoAssignForShift }: Props) {
  const { locale } = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<PreviewAutoAssignForShiftResult | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function loadPreview() {
    setLoadingPreview(true);
    setAssignError(null);
    try {
      const res = await previewAutoAssignForShift(shiftId);
      setPreview(res);
    } finally {
      setLoadingPreview(false);
    }
  }

  function openModal() {
    setOpen(true);
    setPreview(null);
    setAssignError(null);
    void loadPreview();
  }

  function closeModal() {
    setOpen(false);
    setPreview(null);
    setAssignError(null);
  }

  function confirmAssign() {
    setAssignError(null);
    startTransition(async () => {
      const res = await assignAutoAssignForShift(shiftId);
      if (!res.ok) {
        setAssignError(t(res.errorKey as "common.error_generic", locale));
        return;
      }
      closeModal();
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" className="btn btnp" onClick={openModal}>
        {t("auto_assign.run", locale)}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="auto-assign-preview-title"
        >
          <div
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border-b-0 bg-bg-primary shadow-xl sm:max-h-[90vh] sm:rounded-xl sm:border-b border-border-subtle dark:bg-bg-primary dark:border-border-default pb-[env(safe-area-inset-bottom)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-bg-secondary px-3 py-2.5 sm:py-2 dark:border-border-default dark:bg-bg-primary">
              <h3 id="auto-assign-preview-title" className="text-xs font-semibold text-text-primary dark:text-text-primary">
                {t("auto_assign.preview.title", locale)}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="-m-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded p-2 text-text-secondary hover:bg-[var(--bg-brand-subtle)] focus:outline-none touch-manipulation dark:text-text-secondary dark:hover:bg-bg-tertiary"
                aria-label={t("common.close", locale)}
              >
                ✕
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
              {loadingPreview && (
                <p className="text-sm text-text-secondary">{t("auto_assign.preview.loading", locale)}</p>
              )}

              {!loadingPreview && preview && !preview.ok && (
                <p className="text-sm text-red-300 dark:text-red-200">
                  {t(preview.errorKey as "common.error_generic", locale)}
                </p>
              )}

              {!loadingPreview && preview?.ok && (
                <>
                  <p className="text-sm text-text-secondary">
                    {t("auto_assign.preview.needed_slots", locale).replace("{n}", String(preview.needed))}
                  </p>
                  <p className="text-xs text-text-secondary/90">{t("auto_assign.preview.random_hint", locale)}</p>
                  {preview.rows.length === 0 ? (
                    <p className="text-sm text-text-secondary">{t("auto_assign.preview.empty", locale)}</p>
                  ) : (
                    <div className="overflow-x-auto rounded border border-border-subtle dark:border-border-default">
                      <table className="w-full min-w-[320px] text-left text-xs">
                        <thead className="bg-bg-secondary dark:bg-bg-secondary">
                          <tr>
                            <th className="px-2 py-2 font-semibold">{t("auto_assign.preview.col_name", locale)}</th>
                            <th className="px-2 py-2 font-semibold">{t("auto_assign.preview.col_score", locale)}</th>
                            <th className="px-2 py-2 font-semibold">{t("auto_assign.preview.col_status", locale)}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.rows.map((row) => (
                            <tr key={row.user_id}>
                              <td className="px-2 py-1.5 text-text-primary">{row.full_name || "—"}</td>
                              <td className="px-2 py-1.5 tabular-nums">{formatScore(row.score, locale)}</td>
                              <td className="px-2 py-1.5">
                                {t(statusKey(row) as "auto_assign.preview.status_eligible", locale)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {assignError && <p className="text-sm text-red-300 dark:text-red-200">{assignError}</p>}

              <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-border-subtle pt-3 dark:border-border-default">
                <button type="button" className="btn" onClick={closeModal}>
                  {t("auto_assign.preview.cancel", locale)}
                </button>
                <button
                  type="button"
                  className="btnp btn inline-flex items-center gap-1.5"
                  disabled={pending || loadingPreview || !preview?.ok || (preview.ok && preview.needed <= 0)}
                  aria-busy={pending}
                  onClick={confirmAssign}
                >
                  {pending ? (
                    <>
                      <Spinner />
                      <span>…</span>
                    </>
                  ) : (
                    t("auto_assign.preview.confirm", locale)
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";

export default function TreasuryUploadForm({
  organizationId,
  defaultCellRef = "",
  currencyCode
}: {
  organizationId?: string;
  /** Optional server/env default; no hardcoded M9 — user must enter a cell if unset. */
  defaultCellRef?: string;
  currencyCode?: string;
}) {
  const { locale } = useLocale();
  const [mode, setMode] = useState<"excel" | "manual">("excel");
  const [file, setFile] = useState<File | null>(null);
  const [cellRef, setCellRef] = useState(defaultCellRef);
  const [manualAmount, setManualAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "excel" && !file) return;
    if (mode === "manual" && !manualAmount.trim()) return;

    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("mode", mode);
    if (organizationId) formData.append("organization_id", organizationId);

    if (mode === "excel") {
      if (!file) return;
      formData.append("file", file);
      formData.append("cell_ref", cellRef.trim());
    } else {
      formData.append("amount", manualAmount.trim());
    }

    const res = await fetch("/api/treasury/upload", {
      method: "POST",
      body: formData
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);
  setMessage(
    data.errorKey
      ? t(data.errorKey, locale)
      : (data.message || t("finance.balance_updated", locale))
  );
  };

  const isSubmitDisabled =
    loading ||
    (mode === "excel" &&
      (!file || (!cellRef.trim() && !defaultCellRef.trim()))) ||
    (mode === "manual" && !manualAmount.trim());

  return (
    <form onSubmit={onSubmit} className="space-y-4 text-sm">
      <div className="flex gap-4 text-xs text-gray-600 dark:text-gray-400">
        <label className="flex cursor-pointer items-center gap-1">
          <input
            type="radio"
            name="treasury-mode"
            value="excel"
            checked={mode === "excel"}
            onChange={() => setMode("excel")}
            className="border-gray-400"
          />
          {t("finance.excel_upload", locale)}
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name="treasury-mode"
            value="manual"
            checked={mode === "manual"}
            onChange={() => setMode("manual")}
            className="border-gray-400"
          />
          {t("finance.manual_entry", locale)}
        </label>
      </div>

      {mode === "excel" ? (
        <>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
              {t("finance.excel_upload", locale)}
            </label>
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded border border-gray-300 bg-white p-2 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <details className="rounded-lg border border-gray-200 bg-gray-50/80 dark:border-gray-600 dark:bg-gray-800/40">
            <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300">
              {t("finance.advanced_settings", locale)}
            </summary>
            <div className="border-t border-gray-200 px-3 pb-3 pt-2 dark:border-gray-600">
              <div className="flex flex-wrap items-center gap-1.5">
                <label className="mb-1 block w-full text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {t("finance.cell_label", locale)}
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={cellRef}
                    onChange={(e) => setCellRef(e.target.value.toUpperCase())}
                    placeholder={t("finance.cell_placeholder", locale)}
                    autoComplete="off"
                    className="w-36 rounded border border-gray-300 bg-white p-1.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    aria-describedby="treasury-cell-help"
                  />
                  <span
                    id="treasury-cell-help"
                    className="inline-flex shrink-0"
                    title={t("finance.cell_help", locale)}
                  >
                    <HelpCircle
                      className="h-4 w-4 text-gray-400 dark:text-gray-500"
                      aria-hidden
                    />
                    <span className="sr-only">{t("finance.cell_help", locale)}</span>
                  </span>
                </div>
                <p className="mt-1 w-full text-[11px] text-gray-500 dark:text-gray-400">{t("finance.cell_hint", locale)}</p>
              </div>
            </div>
          </details>
        </>
      ) : (
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
            {t("finance.balance_label", locale).replace("{currency}", currencyCode || "—")}
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={manualAmount}
            onChange={(e) => setManualAmount(e.target.value)}
            className="w-40 rounded border border-gray-300 bg-white p-1.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            placeholder={locale === "de" ? "1234,56" : "1234.56"}
          />
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitDisabled}
        className="btn-primary text-xs"
      >
        {loading ? t("finance.saving", locale) : t("finance.update_btn", locale)}
      </button>

      {message && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {message} – {t("finance.dashboard_refresh_hint", locale)}
        </p>
      )}
    </form>
  );
}


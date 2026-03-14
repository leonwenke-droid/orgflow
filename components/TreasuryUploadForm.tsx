"use client";

import { useState } from "react";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";

export default function TreasuryUploadForm({
  organizationId,
  defaultCellRef
}: {
  organizationId?: string;
  defaultCellRef: string;
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
      formData.append("cell_ref", cellRef.trim() || defaultCellRef);
    } else {
      formData.append("amount", manualAmount.trim());
    }

    const res = await fetch("/api/treasury/upload", {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    setLoading(false);
    setMessage(data.message || "Treasury balance updated.");
  };

  const isSubmitDisabled =
    loading ||
    (mode === "excel" && !file) ||
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
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
              {t("finance.cell_label", locale)}
            </label>
            <input
              type="text"
              value={cellRef}
              onChange={(e) => setCellRef(e.target.value.toUpperCase())}
              className="w-32 rounded border border-gray-300 bg-white p-1.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        </>
      ) : (
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
            {t("finance.balance_label", locale)}
          </label>
          <input
            type="number"
            step="0.01"
            value={manualAmount}
            onChange={(e) => setManualAmount(e.target.value)}
            className="w-40 rounded border border-gray-300 bg-white p-1.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            placeholder="1234.56"
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

      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        {t("finance.only_team_note", locale)}
      </p>
      {message && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {message} – Dashboard will update automatically.
        </p>
      )}
    </form>
  );
}


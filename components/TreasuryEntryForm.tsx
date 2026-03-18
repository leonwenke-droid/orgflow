"use client";

import { useState } from "react";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";
import { addTreasuryEntryAction } from "../app/admin/treasury/actions";

export default function TreasuryEntryForm({
  organizationId,
  currencyCode
}: {
  organizationId: string;
  currencyCode: string;
}) {
  const { locale } = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    setLoading(true);
    setError(null);
    setSuccess(false);
    const result = await addTreasuryEntryAction(organizationId, formData);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    form.reset();
    window.location.reload();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
      <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t("finance.add_entry", locale)}</h3>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-0.5 block text-[11px] font-medium text-gray-600 dark:text-gray-400">{t("finance.entry_date", locale)}</label>
          <input type="date" name="date" required className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
        </div>
        <div>
          <label className="mb-0.5 block text-[11px] font-medium text-gray-600 dark:text-gray-400">{t("finance.entry_type", locale)}</label>
          <select name="type" required className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
            <option value="income">{t("finance.entry_type_income", locale)}</option>
            <option value="expense">{t("finance.entry_type_expense", locale)}</option>
          </select>
        </div>
        <div>
          <label className="mb-0.5 block text-[11px] font-medium text-gray-600 dark:text-gray-400">{t("finance.entry_description", locale)}</label>
          <input type="text" name="description" placeholder="" className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
        </div>
        <div>
          <label className="mb-0.5 block text-[11px] font-medium text-gray-600 dark:text-gray-400">
            {t("finance.entry_amount", locale).replace("{currency}", currencyCode)}
          </label>
          <input
            type="text"
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            required
            placeholder={locale === "de" ? "0,00" : "0.00"}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {success && <p className="text-xs text-green-600 dark:text-green-400">Saved.</p>}
      <button type="submit" disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600">
        {loading ? t("finance.saving", locale) : t("common.save", locale)}
      </button>
    </form>
  );
}

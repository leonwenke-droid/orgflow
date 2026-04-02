"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { useLocale } from "../LocaleProvider";
import { t, type Locale } from "../../lib/i18n";
import { formatCurrency } from "../../lib/currency";
import { formatFinanceEntryDateYmd } from "../../lib/formatDate";
import type { LedgerDisplayRow } from "../../lib/financeLedger";
import { addTreasuryEntryAction } from "../../app/admin/treasury/actions";

function typeFilterMatches(typeFilter: "all" | "income" | "expense", row: LedgerDisplayRow) {
  if (typeFilter === "all") return true;
  return row.type === typeFilter;
}

function categoryFilterMatches(cat: string | null, row: LedgerDisplayRow) {
  if (cat === null) return true;
  const r = (row.category ?? "").trim();
  return r === cat;
}

function FinanceArtBadge({ type, locale }: { type: string; locale: Locale }) {
  const income = type === "income";
  return (
    <span
      className={
        income
          ? "inline-flex rounded-full border border-[#27500A]/35 bg-[#EAF3DE] px-2 py-0.5 text-xs font-medium text-[#27500A] dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200"
          : "inline-flex rounded-full border border-[#791F1F]/35 bg-[#FCEBEB] px-2 py-0.5 text-xs font-medium text-[#791F1F] dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200"
      }
    >
      {income ? t("finance.entry_type_income", locale) : t("finance.entry_type_expense", locale)}
    </span>
  );
}

function CategoryPill({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-zinc-400/50 bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:border-border-default dark:bg-zinc-800/80 dark:text-text-secondary">
      {label}
    </span>
  );
}

export default function FinanceLedgerClient({
  initialRows,
  categoryOptions,
  organizationId,
  orgSlug,
  currencyCode
}: {
  initialRows: LedgerDisplayRow[];
  categoryOptions: string[];
  organizationId: string;
  orgSlug: string;
  currencyCode: string;
}) {
  const { locale } = useLocale();
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [categorySelect, setCategorySelect] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const localeMoney = locale === "de" ? "de-DE" : "en-GB";

  const filtered = useMemo(() => {
    return initialRows.filter(
      (r) => typeFilterMatches(typeFilter, r) && categoryFilterMatches(categoryFilter, r)
    );
  }, [initialRows, typeFilter, categoryFilter]);

  function downloadCsv() {
    const sep = locale === "de" ? ";" : ",";
    const headers = [
      t("finance.entry_date", locale),
      t("finance.entry_description", locale),
      t("finance.entry_category", locale),
      t("finance.entry_type", locale),
      t("finance.amount", locale),
      t("finance.col_saldo", locale)
    ];
    const lines = [headers.join(sep)];
    for (const r of filtered) {
      const art =
        r.type === "income"
          ? t("finance.entry_type_income", locale)
          : t("finance.entry_type_expense", locale);
      const amt = (Number(r.amount_cents) / 100).toFixed(2);
      const saldo = (Number(r.saldoCents) / 100).toFixed(2);
      const row = [
        formatFinanceEntryDateYmd(r.date, locale),
        `"${(r.description ?? "").replace(/"/g, '""')}"`,
        `"${(r.category ?? "").replace(/"/g, '""')}"`,
        `"${art}"`,
        amt.replace(".", locale === "de" ? "," : "."),
        saldo.replace(".", locale === "de" ? "," : ".")
      ];
      lines.push(row.join(sep));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `finanzen-${orgSlug}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function onSubmitBook(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const desc = (fd.get("description") as string)?.trim() ?? "";
    if (!desc) {
      setFormError(t("finance.error_description_required", locale));
      return;
    }
    const catSel = (fd.get("category") as string) ?? "";
    if (catSel === "__new__") {
      fd.set("category", ((fd.get("category_new") as string) ?? "").trim());
    }
    startTransition(async () => {
      const res = await addTreasuryEntryAction(organizationId, fd);
      if (res?.error) {
        setFormError(res.error);
        return;
      }
      setFormOpen(false);
      form.reset();
      setCategorySelect("");
      router.refresh();
    });
  }

  const pillClass = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
      active
        ? "bg-blue-600 text-white dark:bg-blue-600"
        : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-text-primary dark:hover:bg-zinc-700"
    }`;

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-primary p-4 shadow-sm dark:border-border-default dark:bg-bg-primary/60 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-text-primary">
            {t("finance.section_bookings", locale)}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={pillClass(typeFilter === "all")} onClick={() => setTypeFilter("all")}>
              {t("finance.filter_all", locale)}
            </button>
            <button
              type="button"
              className={pillClass(typeFilter === "income")}
              onClick={() => setTypeFilter("income")}
            >
              {t("finance.filter_income", locale)}
            </button>
            <button
              type="button"
              className={pillClass(typeFilter === "expense")}
              onClick={() => setTypeFilter("expense")}
            >
              {t("finance.filter_expense", locale)}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={pillClass(categoryFilter === null)}
              onClick={() => setCategoryFilter(null)}
            >
              {t("finance.filter_all_categories", locale)}
            </button>
            {categoryOptions.map((c) => (
              <button
                key={c}
                type="button"
                className={pillClass(categoryFilter === c)}
                onClick={() => setCategoryFilter(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={downloadCsv} className="btn-secondary inline-flex items-center gap-1 text-sm">
            {t("finance.export_csv_link", locale)}
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="btn-primary text-sm"
          >
            {t("finance.btn_book", locale)}
          </button>
        </div>
      </div>

      {formOpen && (
        <form
          onSubmit={onSubmitBook}
          className="mt-4 space-y-3 rounded-lg border border-border-subtle bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-950/40"
        >
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-text-primary">{t("finance.form_title", locale)}</h3>
          <input type="hidden" name="organization_id" value={organizationId} />
          <input type="hidden" name="org_slug" value={orgSlug} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-0.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                {t("finance.entry_description", locale)} *
              </label>
              <input
                name="description"
                required
                className="w-full rounded-lg border border-border-default bg-bg-primary px-2 py-2 text-sm dark:border-border-default dark:bg-bg-primary dark:text-text-primary"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                {t("finance.entry_amount", locale).replace("{currency}", currencyCode)} *
              </label>
              <input
                name="amount"
                type="text"
                inputMode="decimal"
                required
                placeholder={locale === "de" ? "0,00" : "0.00"}
                className="w-full rounded-lg border border-border-default bg-bg-primary px-2 py-2 text-sm dark:border-border-default dark:bg-bg-primary dark:text-text-primary"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                {t("finance.entry_type", locale)} *
              </label>
              <select
                name="type"
                required
                className="w-full rounded-lg border border-border-default bg-bg-primary px-2 py-2 text-sm dark:border-border-default dark:bg-bg-primary dark:text-text-primary"
              >
                <option value="expense">{t("finance.entry_type_expense", locale)}</option>
                <option value="income">{t("finance.entry_type_income", locale)}</option>
              </select>
            </div>
            <div>
              <label className="mb-0.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                {t("finance.entry_category", locale)}
              </label>
              <select
                name="category"
                value={categorySelect}
                onChange={(e) => setCategorySelect(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-bg-primary px-2 py-2 text-sm dark:border-border-default dark:bg-bg-primary dark:text-text-primary"
              >
                <option value="">—</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="__new__">{t("finance.category_new_option", locale)}</option>
              </select>
            </div>
            {categorySelect === "__new__" && (
              <div>
                <label className="mb-0.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  {t("finance.category_new_name", locale)}
                </label>
                <input
                  name="category_new"
                  className="w-full rounded-lg border border-border-default bg-bg-primary px-2 py-2 text-sm dark:border-border-default dark:bg-bg-primary dark:text-text-primary"
                />
              </div>
            )}
            <div>
              <label className="mb-0.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                {t("finance.entry_date", locale)} *
              </label>
              <input
                name="date"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="w-full rounded-lg border border-border-default bg-bg-primary px-2 py-2 text-sm dark:border-border-default dark:bg-bg-primary dark:text-text-primary"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-0.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                {t("finance.field_receipt", locale)}
              </label>
              <input
                name="receipt"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="block w-full text-sm text-zinc-600 file:mr-2 file:rounded file:border-0 file:bg-blue-600 file:px-2 file:py-1 file:text-white dark:text-text-secondary"
              />
            </div>
          </div>
          {formError && <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary text-sm">
              {pending ? t("finance.saving", locale) : t("common.save", locale)}
            </button>
            <button type="button" className="btn-secondary text-sm" onClick={() => setFormOpen(false)}>
              {t("common.cancel", locale)}
            </button>
          </div>
        </form>
      )}

      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">{t("finance.entries_empty", locale)}</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-xs font-medium text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                <th className="pb-2 pr-3">{t("finance.entry_date", locale)}</th>
                <th className="pb-2 pr-3">{t("finance.entry_description", locale)}</th>
                <th className="pb-2 pr-3">{t("finance.entry_category", locale)}</th>
                <th className="pb-2 pr-3">{t("finance.entry_type", locale)}</th>
                <th className="pb-2 pr-3 text-right">{t("finance.amount", locale)}</th>
                <th className="pb-2 text-right">{t("finance.col_saldo", locale)}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const income = r.type === "income";
                const amt = Number(r.amount_cents) / 100;
                const absFmt = formatCurrency(Math.abs(amt), localeMoney, currencyCode);
                const signed = income ? `+${absFmt}` : `−${absFmt}`;
                return (
                  <tr
                    key={r.id}
                    className="border-b border-zinc-100 dark:border-border-default/80"
                  >
                    <td className="py-2.5 pr-3 text-zinc-500 dark:text-zinc-400">
                      {formatFinanceEntryDateYmd(r.date, locale)}
                    </td>
                    <td className="py-2.5 pr-3 font-medium text-zinc-900 dark:text-text-primary">
                      {r.description ?? "—"}
                    </td>
                    <td className="py-2.5 pr-3">
                      {(r.category ?? "").trim() ? (
                        <CategoryPill label={(r.category ?? "").trim()} />
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <FinanceArtBadge type={r.type} locale={locale} />
                    </td>
                    <td
                      className={`py-2.5 pr-3 text-right font-semibold tabular-nums ${
                        income ? "text-[#639922] dark:text-green-400" : "text-[#E24B4A] dark:text-red-400"
                      }`}
                    >
                      {signed}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatCurrency(Number(r.saldoCents) / 100, localeMoney, currencyCode)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

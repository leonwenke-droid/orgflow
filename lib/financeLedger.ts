import type { Locale } from "./i18n";

export type TreasuryEntryRow = {
  id: string;
  date: string;
  description: string | null;
  amount_cents: number;
  type: string;
  category: string | null;
};

export type LedgerDisplayRow = TreasuryEntryRow & { saldoCents: number };

/** Chronological running balance, then newest-first for display. */
export function buildLedgerDisplayRows(entries: TreasuryEntryRow[]): LedgerDisplayRow[] {
  const sorted = [...entries].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    return a.id.localeCompare(b.id);
  });
  let running = 0;
  const asc: LedgerDisplayRow[] = sorted.map((e) => {
    running += Number(e.amount_cents);
    return { ...e, saldoCents: running };
  });
  return asc.reverse();
}

export function distinctCategoriesFromEntries(entries: TreasuryEntryRow[]): string[] {
  const set = new Set<string>();
  for (const e of entries) {
    const c = (e.category ?? "").trim();
    if (c) set.add(c);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function monthKeysLast6(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function formatMonthShortLabel(ym: string, locale: Locale): string {
  const [ys, ms] = ym.split("-");
  const d = new Date(Number(ys), Number(ms) - 1, 1);
  const loc = locale === "en" ? "en-GB" : "de-DE";
  return new Intl.DateTimeFormat(loc, { month: "short" }).format(d).replace(/\.$/, "");
}

export type MonthBarDatum = { key: string; label: string; incomeCents: number; expenseCents: number };

export function buildSixMonthChartData(entries: TreasuryEntryRow[], locale: Locale): MonthBarDatum[] {
  const keys = monthKeysLast6();
  const byMonth: Record<string, { income: number; expense: number }> = {};
  for (const k of keys) byMonth[k] = { income: 0, expense: 0 };
  for (const e of entries) {
    const mk = e.date.slice(0, 7);
    if (!byMonth[mk]) continue;
    if (e.type === "income") byMonth[mk].income += Math.abs(Number(e.amount_cents));
    else if (e.type === "expense") byMonth[mk].expense += Math.abs(Number(e.amount_cents));
  }
  return keys.map((key) => ({
    key,
    label: formatMonthShortLabel(key, locale),
    incomeCents: byMonth[key].income,
    expenseCents: byMonth[key].expense
  }));
}

export function sum30dMetrics(entries: TreasuryEntryRow[]): {
  incomeCents: number;
  expenseCents: number;
  incomeCount: number;
  expenseCount: number;
} {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  let incomeCents = 0;
  let expenseCents = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  for (const e of entries) {
    if (e.date < cutoffStr) continue;
    if (e.type === "income") {
      incomeCents += Math.abs(Number(e.amount_cents));
      incomeCount += 1;
    } else if (e.type === "expense") {
      expenseCents += Math.abs(Number(e.amount_cents));
      expenseCount += 1;
    }
  }
  return { incomeCents, expenseCents, incomeCount, expenseCount };
}

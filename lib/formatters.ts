/**
 * Display helpers for DB enum values and shift availability (UI).
 * Keep labels in sync with `lib/i18n.ts` where possible.
 */

export const TASK_STATUS_LABELS_DE: Record<string, string> = {
  offen: "Offen",
  in_arbeit: "In Arbeit",
  erledigt: "Erledigt",
  ueberfaellig: "Überfällig",
  abgebrochen: "Abgebrochen"
};

export const TASK_STATUS_LABELS_EN: Record<string, string> = {
  offen: "Open",
  in_arbeit: "In progress",
  erledigt: "Done",
  ueberfaellig: "Overdue",
  abgebrochen: "Cancelled"
};

export const TASK_STATUS_COLORS: Record<string, string> = {
  in_arbeit: "bg-[var(--bg-warning-subtle)] text-[var(--color-warning-text)]",
  offen: "bg-[var(--bg-secondary)] text-[var(--text-secondary)]",
  erledigt: "bg-[var(--bg-success-subtle)] text-[var(--color-success-text)]",
  ueberfaellig: "bg-[var(--bg-danger-subtle)] text-[var(--color-danger-text)]",
  abgebrochen: "bg-[var(--bg-secondary)] text-[var(--text-muted)]",
};

export type AppLocale = "en" | "de";

export function formatTaskStatus(status: string, locale: AppLocale = "de"): string {
  const map = locale === "en" ? TASK_STATUS_LABELS_EN : TASK_STATUS_LABELS_DE;
  return map[status] ?? status;
}

/** Traffic-light dot for slot availability (Tailwind bg-* class). */
export function shiftSlotDotClass(free: number, required: number): string {
  const req = Math.max(1, required);
  if (free <= 0) return "bg-red-500";
  const ratio = free / req;
  if (ratio <= 0.25) return "bg-amber-500";
  if (ratio <= 0.5) return "bg-yellow-400";
  return "bg-emerald-500";
}

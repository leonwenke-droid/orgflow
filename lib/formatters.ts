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
  in_arbeit: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-100",
  offen: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200",
  erledigt: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-100",
  ueberfaellig: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-100",
  abgebrochen: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
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

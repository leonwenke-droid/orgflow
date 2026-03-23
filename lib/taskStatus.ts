/**
 * Visual left border for task rows (PHASE 7).
 */
export const STATUS_BORDER: Record<string, string> = {
  in_arbeit: "border-l-4 border-l-amber-400",
  ueberfaellig: "border-l-4 border-l-red-500",
  offen: "border-l-4 border-l-gray-200 dark:border-l-gray-600",
  erledigt: "border-l-4 border-l-green-400 opacity-60",
  abgebrochen: "border-l-4 border-l-slate-400 opacity-80"
};

export function taskRowBorderClass(status: string | null | undefined, dueAt: string | null | undefined): string {
  const s = String(status ?? "").trim();
  if (s === "erledigt") return STATUS_BORDER.erledigt;
  if (s === "ueberfaellig") return STATUS_BORDER.ueberfaellig;
  if (s === "abgebrochen") return STATUS_BORDER.abgebrochen;
  const due = dueAt ? new Date(dueAt).getTime() : NaN;
  const overdue = !Number.isNaN(due) && due < Date.now() && s !== "erledigt" && s !== "abgebrochen";
  if (overdue) return STATUS_BORDER.ueberfaellig;
  if (s === "in_arbeit") return STATUS_BORDER.in_arbeit;
  return STATUS_BORDER.offen;
}

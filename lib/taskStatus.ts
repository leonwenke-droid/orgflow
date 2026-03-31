/**
 * Visual left border for task rows (PHASE 7).
 */
export const STATUS_BORDER: Record<string, string> = {
  in_arbeit: "border-l-[3px] border-l-[#BA7517]",
  ueberfaellig: "border-l-[3px] border-l-[#A32D2D]",
  offen: "border-l-[3px] border-l-gray-200 dark:border-l-gray-700",
  erledigt: "border-l-[3px] border-l-[#3B6D11] opacity-60",
  abgebrochen: "border-l-[3px] border-l-muted opacity-80 dark:border-l-muted-dark"
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

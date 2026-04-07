/** Shared tab helpers — must NOT live in a `"use client"` file so server components (e.g. admin/shifts/page) can import safely. */

export type ShiftsConsoleTabId = "admin" | "cal" | "member" | "attend" | "qr" | "stats";

export const SHIFTS_CONSOLE_TAB_ORDER: ShiftsConsoleTabId[] = [
  "admin",
  "cal",
  "member",
  "attend",
  "qr",
  "stats"
];

export function normalizeShiftsConsoleTab(tab: string | null | undefined): ShiftsConsoleTabId {
  if (tab && SHIFTS_CONSOLE_TAB_ORDER.includes(tab as ShiftsConsoleTabId)) return tab as ShiftsConsoleTabId;
  return "admin";
}

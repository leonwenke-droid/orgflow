/**
 * Erinnerungsfenster für stündlichen Cron (n8n).
 * Jede Schicht / Aufgabe wird genau einmal erinnert (Dedupe via reminder_logs).
 */
export const REMINDER_MIN_REMAINING_MS = 22 * 60 * 60 * 1000;
export const REMINDER_MAX_REMAINING_MS = 26 * 60 * 60 * 1000;

export function reminderTargetWindowIso(nowMs: number): { lowIso: string; highIso: string } {
  return {
    lowIso: new Date(nowMs + REMINDER_MIN_REMAINING_MS).toISOString(),
    highIso: new Date(nowMs + REMINDER_MAX_REMAINING_MS).toISOString()
  };
}

/** True wenn verbleibende Zeit vor Start im Erinnerungsfenster liegt (nur zukünftige Events). */
export function isInShiftReminderWindow(nowMs: number, eventStartMs: number): boolean {
  const remaining = eventStartMs - nowMs;
  if (remaining <= 0) return false;
  return remaining >= REMINDER_MIN_REMAINING_MS && remaining <= REMINDER_MAX_REMAINING_MS;
}

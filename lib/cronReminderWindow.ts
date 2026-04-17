/**
 * “24h vorher”-Erinnerungen: einmal auslösen, wenn die verbleibende Zeit
 * in einem Band um genau 24h liegt (Cron-toleranz).
 *
 * Halbbreite ±1h: passt zu stündlichem Cron; bei häufigerem Cron kann die
 * Fensterlogik enger gesetzt werden.
 */
export const REMINDER_LEAD_MS = 24 * 60 * 60 * 1000;
export const REMINDER_WINDOW_HALF_MS = 60 * 60 * 1000;

export function reminderTargetWindowIso(nowMs: number): { lowIso: string; highIso: string } {
  const lowMs = nowMs + REMINDER_LEAD_MS - REMINDER_WINDOW_HALF_MS;
  const highMs = nowMs + REMINDER_LEAD_MS + REMINDER_WINDOW_HALF_MS;
  return {
    lowIso: new Date(lowMs).toISOString(),
    highIso: new Date(highMs).toISOString()
  };
}

/** True if `eventStartMs - nowMs` liegt im Erinnerungsfenster vor dem Start (nur zukünftige Events). */
export function isInShiftReminderWindow(nowMs: number, eventStartMs: number): boolean {
  const remaining = eventStartMs - nowMs;
  if (remaining <= 0) return false;
  return (
    remaining >= REMINDER_LEAD_MS - REMINDER_WINDOW_HALF_MS &&
    remaining <= REMINDER_LEAD_MS + REMINDER_WINDOW_HALF_MS
  );
}

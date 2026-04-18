/**
 * Erinnerungen „ca. einen Tag vorher“ bei **täglichem** Cron (Vercel Hobby: max. 1×/Tag).
 *
 * Statt eines schmalen ±1h-Bands um exakt 24h (dafür bräuchte man stündliche Crons, Pro)
 * wählen wir ein Fenster **12h–48h** vor Deadline/Schichtbeginn. Beim ersten Lauf nach
 * Eintritt in dieses Fenster wird gesendet (Dedupe über task_reminder_logs /
 * shift_reminder_logs). Pro-Nutzer können in vercel.json auf stündliche Schedules wechseln
 * und optional engere Konstanten nutzen.
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

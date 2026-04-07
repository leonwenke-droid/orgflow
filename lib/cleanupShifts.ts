import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSoftDeleteColumnError } from "./supabaseSoftDelete";
import { SHIFT_TRASH_RETENTION_DAYS } from "./shiftTrashConfig";

export { SHIFT_TRASH_RETENTION_DAYS } from "./shiftTrashConfig";

/**
 * Entfernt Schichten, die seit mindestens `days` Tagen im Papierkorb liegen (`deleted_at` gesetzt).
 * `shift_assignments` folgt per ON DELETE CASCADE.
 */
export async function purgeShiftTrashOlderThanDays(supabase: SupabaseClient, days: number) {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const cutoffIso = cutoff.toISOString();
  const { error } = await supabase
    .from("shifts")
    .delete()
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoffIso);
  if (error && !isMissingSoftDeleteColumnError(error.message)) {
    console.error("[purgeShiftTrashOlderThanDays]", error.message);
  }
}

/**
 * Beim Laden der Schichtplanung: Papierkorb abräumen (Retention).
 * (Früher: keine automatische Gutschrift für vergangene Schichten.)
 */
export async function removePastShifts(supabase: SupabaseClient) {
  await purgeShiftTrashOlderThanDays(supabase, SHIFT_TRASH_RETENTION_DAYS);
}

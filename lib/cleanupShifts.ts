import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Vergangene Schichten werden nicht mehr automatisch mit Punkten gutgeschrieben.
 * Stattdessen wird im Admin-Bereich pro Zuweisung abgefragt, ob die Person
 * angetreten ist; optional kann eine Ersatzperson eingetragen werden, die dann
 * die Punkte erhält.
 */
export async function removePastShifts(_supabase: SupabaseClient) {
  // Keine automatische Gutschrift mehr – Abfrage erfolgt im Admin (Schichten).
}

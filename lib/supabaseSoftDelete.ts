/**
 * Wenn die Soft-Delete-Migration (`tasks`/`shifts`.`deleted_at`) noch nicht angewendet ist,
 * liefern PostgREST-Fehler wie "column ... deleted_at does not exist".
 */
export function isMissingSoftDeleteColumnError(message: string | undefined | null): boolean {
  if (!message) return false;
  return message.includes("deleted_at") && message.includes("does not exist");
}

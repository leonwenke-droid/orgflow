import { redirect } from "next/navigation";
import type { DbRole } from "../types";

/** Viewer sehen nur die gemeinsame Gesamtübersicht (und z. B. Konto/Feedback), keine operativen Member-Routen. */
export function redirectViewerToOrgOverview(orgSlug: string, role: DbRole | string | null | undefined) {
  if (role === "viewer") {
    redirect(`/${orgSlug}/overview`);
  }
}

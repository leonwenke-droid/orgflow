import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getCurrentUserOrganization, getAllOrganizations } from "../../lib/getOrganization";

export const dynamic = "force-dynamic";

/**
 * /dashboard → Dashboard eines Jahrgangs.
 * Eingeloggt: Redirect auf die eigene Org. Nicht eingeloggt: Redirect auf erstes verfügbares Org-Dashboard (ohne Login).
 */
export default async function DashboardRedirect() {
  const org = await getCurrentUserOrganization();
  if (org) redirect(`/${org.slug}/dashboard`);
  const orgs = await getAllOrganizations();
  const first = orgs[0];
  if (first) redirect(`/${first.slug}/dashboard`);
  redirect("/");
}

import { redirect } from "next/navigation";
import { getCurrentUserOrganization } from "../../lib/getOrganization";

/**
 * Leitet auf das Admin-Board der Organisation des eingeloggten Users weiter.
 * Multi-Tenant: /admin → /[slug]/admin (z. B. /abi-2026-tgg/admin).
 */
export default async function AdminRedirect() {
  const org = await getCurrentUserOrganization();
  if (!org) {
    redirect("/");
  }
  redirect(`/${org.slug}/admin`);
}

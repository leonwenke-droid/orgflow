import { redirect } from "next/navigation";
import { getCurrentUserOrganization, getOrganizationsForCurrentUser } from "../../lib/getOrganization";

/**
 * Leitet auf das Admin-Board der Organisation des eingeloggten Users weiter.
 * Multi-Tenant: /admin → /[slug]/admin (z. B. /mein-verein/admin).
 * Mehrere Orgs: Hub unter /dashboard, damit alle Organisationen erreichbar sind.
 */
export default async function AdminRedirect() {
  const org = await getCurrentUserOrganization();
  if (!org) {
    const memberships = await getOrganizationsForCurrentUser();
    if (memberships.length > 0) {
      redirect("/dashboard");
    }
    redirect("/");
  }
  redirect(`/${org.slug}/admin`);
}

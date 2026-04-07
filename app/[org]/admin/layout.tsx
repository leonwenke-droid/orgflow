import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getCurrentOrganization, resolveMemberProfileForOrganization } from "../../../lib/getOrganization";
import type { DbRole } from "../../../types";

export const dynamic = "force-dynamic";

/** Org-scoped roles that may use /[org]/admin/* (Mitgliedschaft in dieser Organisation). */
const ORG_ADMIN_AREA_ROLES = new Set<DbRole>(["admin", "owner", "teamlead", "lead"]);

export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { org: string };
}) {
  const supabase = createServerComponentClient({ cookies });
  const [{ data: auth }, org] = await Promise.all([
    supabase.auth.getUser(),
    getCurrentOrganization(params.org),
  ]);

  const user = auth.user;
  if (!user) redirect(`/${params.org}/login`);

  const member = await resolveMemberProfileForOrganization(user.id, params.org, org);
  const role = (member?.role ?? null) as DbRole | null;
  let ok = role != null && ORG_ADMIN_AREA_ROLES.has(role);
  // Plattform-Super-Admin (Developer): alle Orgs, unabhängig von Org-Rolle — bewusst getrennt vom Org-Admin.
  if (!ok) {
    const { data: isPlatformSuperAdmin } = await supabase.rpc("is_super_admin");
    if (isPlatformSuperAdmin === true) ok = true;
  }

  if (!ok) redirect(`/${params.org}/dashboard`);

  return <>{children}</>;
}

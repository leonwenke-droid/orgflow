import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getCurrentOrganization, resolveMemberProfileForOrganization } from "../../../lib/getOrganization";
import type { DbRole } from "../../../types";

export const dynamic = "force-dynamic";

const ADMIN_ACCESS_ROLES = new Set<DbRole>(["admin", "owner", "teamlead", "lead", "super_admin"]);

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
  let ok = role != null && ADMIN_ACCESS_ROLES.has(role);
  if (!ok) {
    const { data: isSuper } = await supabase.rpc("is_super_admin");
    if (isSuper === true) ok = true;
  }

  if (!ok) redirect(`/${params.org}/dashboard`);

  return <>{children}</>;
}

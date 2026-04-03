import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getCurrentOrganization } from "../../../lib/getOrganization";

export const dynamic = "force-dynamic";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("auth_user_id", user.id)
    .eq("organization_id", org.id)
    .maybeSingle();

  const role = profile?.role as string | undefined;
  const ok =
    profile?.status !== "disabled" &&
    (role === "admin" || role === "owner" || role === "teamlead");

  if (!ok) redirect(`/${params.org}/dashboard`);

  return <>{children}</>;
}


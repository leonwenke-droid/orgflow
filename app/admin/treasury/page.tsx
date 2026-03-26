import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { getCurrentUserOrganization } from "../../../lib/getOrganization";

export const dynamic = "force-dynamic";

type TreasuryRedirectProps = { searchParams?: Promise<{ org?: string }> | { org?: string } };

export default async function TreasuryRedirectPage(props: TreasuryRedirectProps) {
  const raw = props.searchParams;
  const searchParams =
    raw && typeof (raw as Promise<unknown>).then === "function"
      ? await (raw as Promise<{ org?: string }>)
      : ((raw ?? {}) as { org?: string });
  const orgSlug = searchParams?.org?.trim();
  if (orgSlug) {
    redirect(`/${orgSlug}/admin/finanzen`);
  }

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const userOrg = await getCurrentUserOrganization();
  if (userOrg?.slug) redirect(`/${userOrg.slug}/admin/finanzen`);

  redirect("/dashboard");
}

import { redirect } from "next/navigation";
import { getCurrentOrganization, getEffectiveUserRoleForOrg } from "../../lib/getOrganization";

export const dynamic = "force-dynamic";

export default async function OrgRootPage(props: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const params =
    typeof (props.params as Promise<{ org: string }>).then === "function"
      ? await (props.params as Promise<{ org: string }>)
      : (props.params as { org: string });

  const orgSlug = params.org;
  const org = await getCurrentOrganization(orgSlug);
  const role = await getEffectiveUserRoleForOrg(orgSlug, org);
  if (role === "viewer") {
    redirect(`/${orgSlug}/overview`);
  }
  redirect(`/${orgSlug}/dashboard`);
}

import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getCurrentOrganization, getOrgIdForData, isOrgAdmin } from "../../../lib/getOrganization";
import AuthForm from "../../../components/AuthForm";
import AuthPageShell from "../../../components/auth/AuthPageShell";

/**
 * Login nur für diese Organisation (Admin-Board). Nach Login → redirectTo oder /[org]/admin.
 */
export default async function OrgLoginPage({
  params,
  searchParams
}: {
  params: Promise<{ org: string }> | { org: string };
  searchParams: Promise<{ redirectTo?: string }> | { redirectTo?: string };
}) {
  const orgSlug = typeof (params as Promise<{ org: string }>).then === "function"
    ? (await (params as Promise<{ org: string }>)).org
    : (params as { org: string }).org;
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);

  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const canManage = await isOrgAdmin(orgIdForData);
    redirect(`/${orgSlug}/${canManage ? "admin" : "dashboard"}`);
  }

  const q = typeof (searchParams as Promise<{ redirectTo?: string }>).then === "function"
    ? await (searchParams as Promise<{ redirectTo?: string }>)
    : (searchParams as { redirectTo?: string });
  const redirectTo = q?.redirectTo?.trim() || `/${orgSlug}/dashboard`;

  return (
    <AuthPageShell>
      <div className="auth-card space-y-5">
        <div>
          <h1 className="auth-title">Sign in</h1>
          <p className="auth-sub">
            <span className="font-medium text-text-secondary">{org.name}</span>
            <span className="mt-1 block font-normal">
              Sign in to your organisation account.
            </span>
          </p>
        </div>
        <AuthForm redirectTo={redirectTo} />
      </div>
    </AuthPageShell>
  );
}

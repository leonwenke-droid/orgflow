import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getCurrentOrganization } from "../../../lib/getOrganization";
import AuthForm from "../../../components/AuthForm";

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

  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(`/${orgSlug}/admin`);

  const q = typeof (searchParams as Promise<{ redirectTo?: string }>).then === "function"
    ? await (searchParams as Promise<{ redirectTo?: string }>)
    : (searchParams as { redirectTo?: string });
  const redirectTo = q?.redirectTo?.trim() || `/${orgSlug}/admin`;

  return (
    <div className="mx-auto max-w-sm">
      <div className="card space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-cyan-400">
            Anmelden – {org.name}
          </h2>
          <p className="mt-1 text-xs text-cyan-400/80">
            Für das Admin-Board dieses Jahrgangs.
          </p>
        </div>
        <AuthForm redirectTo={redirectTo} />
      </div>
    </div>
  );
}

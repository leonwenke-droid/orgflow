import { cookies } from "next/headers";
import Link from "next/link";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import TreasuryUploadForm from "../../../components/TreasuryUploadForm";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { getCurrentOrganization, isOrgAdmin, getCurrentUserOrganization } from "../../../lib/getOrganization";
import AdminBreadcrumb from "../../../components/AdminBreadcrumb";

export const dynamic = "force-dynamic";

type TreasuryPageProps = { searchParams?: Promise<{ org?: string }> | { org?: string } };

export default async function TreasuryPage(props: TreasuryPageProps) {
  const raw = props.searchParams;
  const searchParams = raw && typeof (raw as Promise<unknown>).then === "function"
    ? await (raw as Promise<{ org?: string }>)
    : (raw ?? {}) as { org?: string };
  const orgSlug = searchParams?.org?.trim() || null;

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const userId = user?.id;

  if (!userId) {
    const loginHref = orgSlug ? `/${orgSlug}/login` : "/";
    return (
      <p className="text-sm text-amber-300">
        Session not recognised. Please <a href={loginHref} className="underline">sign in again</a>.
      </p>
    );
  }

  const service = createSupabaseServiceRoleClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id, role, organization_id")
    .eq("auth_user_id", userId)
    .single();

  if (!profile || !["admin", "lead", "super_admin"].includes(profile.role)) {
    return (
      <p className="text-sm text-red-300">
        Access only for admins & team leads.
      </p>
    );
  }

  let orgId: string | null = null;
  if (orgSlug) {
    try {
      const org = await getCurrentOrganization(orgSlug);
      if (await isOrgAdmin(org.id)) orgId = org.id;
    } catch {
      orgId = null;
    }
  }
  if (!orgId && profile.organization_id) orgId = profile.organization_id;

  let effectiveOrgSlug = orgSlug;
  if (!effectiveOrgSlug && orgId) {
    const userOrg = await getCurrentUserOrganization();
    effectiveOrgSlug = userOrg?.slug ?? null;
  }

  let treasuryQuery = service
    .from("treasury_updates")
    .select("amount, created_at")
    .order("created_at", { ascending: false })
    .limit(1);
  if (orgId) treasuryQuery = treasuryQuery.eq("organization_id", orgId);
  const { data: lastUpdate } = await treasuryQuery.maybeSingle();

  const defaultCellRef = process.env.TREASURY_EXCEL_CELL ?? "M9";

  return (
    <div className="space-y-4">
      {effectiveOrgSlug && (
        <AdminBreadcrumb orgSlug={effectiveOrgSlug} currentLabel="Treasury" />
      )}
      <section className="card space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">
          Treasury balance
        </h2>
        <p className="text-xs text-gray-600">
          You can either{" "}
          <span className="font-semibold">enter the balance manually</span> or update via{" "}
          <span className="font-semibold">Excel (.xlsx)</span>. By default, Excel uses cell{" "}
          <code className="rounded bg-gray-100 px-1">
            {defaultCellRef}
          </code>{" "}
          as the balance – you can change this in the form.
        </p>
        {lastUpdate && (
          <p className="text-xs text-gray-500">
            Last balance:{" "}
            <span className="font-semibold">
              {Number(lastUpdate.amount).toLocaleString("de-DE")} €
            </span>{" "}
            ({new Date(lastUpdate.created_at).toLocaleString("de-DE")})
          </p>
        )}
      </section>

      <section className="card">
        <TreasuryUploadForm organizationId={orgId ?? undefined} defaultCellRef={defaultCellRef} />
      </section>
    </div>
  );
}

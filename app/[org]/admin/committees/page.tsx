import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getCurrentOrganization,
  getCurrentUserRoleInOrg,
  getOrgIdForData,
  isOrgAdmin
} from "../../../../lib/getOrganization";
import { canManageMembersAndTeams } from "../../../../lib/permissions";
import AdminBreadcrumb from "../../../../components/AdminBreadcrumb";
import AdminForbidden from "../AdminForbidden";
import CreateCommitteeForm from "./CreateCommitteeForm";
import CommitteeRow from "./CommitteeRow";
import EmptyState from "../../../../components/EmptyState";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";

export default async function AdminCommitteesPage(props: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const params = props.params;
  const orgSlug = typeof (params as Promise<{ org: string }>).then === "function"
    ? (await (params as Promise<{ org: string }>)).org
    : (params as { org: string }).org;
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;
  const userRole = await getCurrentUserRoleInOrg(orgIdForData, org.id);
  if (!canManageMembersAndTeams(userRole)) {
    return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;
  }

  const supabase = createServerComponentClient({ cookies });
  const { data: committees } = await supabase
    .from("committees")
    .select("id, name, description, is_active")
    .eq("organization_id", orgIdForData)
    .order("name");

  const service = createSupabaseServiceRoleClient();
  const committeeList = committees ?? [];
  const committeeIds = committeeList.map((c: { id: string }) => c.id);
  const memberCountByCommittee: Record<string, number> = Object.fromEntries(committeeIds.map((id) => [id, 0]));

  if (committeeIds.length > 0) {
    const { data: profiles } = await service
      .from("profiles")
      .select("id, committee_id")
      .eq("organization_id", orgIdForData);
    const profileIds = (profiles ?? []).map((p: { id: string }) => p.id);
    const { data: pcRows } =
      profileIds.length > 0
        ? await service.from("profile_committees").select("user_id, committee_id").in("user_id", profileIds)
        : { data: [] as { user_id: string; committee_id: string }[] };

    const sets: Record<string, Set<string>> = Object.fromEntries(committeeIds.map((id) => [id, new Set<string>()]));

    for (const p of profiles ?? []) {
      const row = p as { id: string; committee_id?: string | null };
      if (row.committee_id && sets[row.committee_id]) {
        sets[row.committee_id].add(row.id);
      }
    }
    for (const r of pcRows ?? []) {
      const row = r as { user_id: string; committee_id: string };
      if (sets[row.committee_id]) {
        sets[row.committee_id].add(row.user_id);
      }
    }
    for (const id of committeeIds) {
      memberCountByCommittee[id] = sets[id]?.size ?? 0;
    }
  }

  const committeesWithCounts = committeeList.map(
    (c: { id: string; name: string; description?: string | null; is_active?: boolean | null }) => ({
      ...c,
      memberCount: memberCountByCommittee[c.id] ?? 0
    })
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <header>
        <AdminBreadcrumb orgSlug={orgSlug} currentLabel="Teams" />
        <h1 className="page-title">Teams</h1>
        <p className="page-sub">{org.name}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {committeesWithCounts.map((c: any) => (
          <CommitteeRow key={c.id} orgSlug={orgSlug} committee={c} />
        ))}

        <div className="card border border-dashed border-gray-200">
          <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 p-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 text-lg font-medium text-gray-700">+</div>
            <div className="text-sm font-medium text-gray-900">Neues Team anlegen</div>
            <div className="text-xs text-gray-500">Erstellt ein neues Team für Aufgaben & Schichten.</div>
            <a href="#create-team" className="btn-primary mt-2">Team erstellen</a>
          </div>
        </div>
      </div>

      <div id="create-team" className="card p-4">
        <div className="section-label">Neues Team</div>
        <CreateCommitteeForm orgSlug={orgSlug} orgId={org.id} committees={committeeList} />
      </div>

      {(!committees || committees.length === 0) ? (
        <div className="card p-4">
          <EmptyState messageKey="empty.teams" actionHref={`/${orgSlug}/admin/committees`} actionLabelKey="cta.create_team" />
        </div>
      ) : null}
    </div>
  );
}

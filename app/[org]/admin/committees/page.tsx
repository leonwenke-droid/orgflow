import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getCurrentOrganization,
  getEffectiveUserRoleForOrg,
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
  if (!(await isOrgAdmin(orgIdForData, orgSlug))) return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;
  const userRole = await getEffectiveUserRoleForOrg(orgSlug, org);
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

  const todayStr = new Date().toISOString().slice(0, 10);
  const [{ data: openTaskRows }, { data: upcomingShiftRows }] = await Promise.all([
    committeeIds.length > 0
      ? service
          .from("tasks")
          .select("id, committee_id")
          .eq("organization_id", orgIdForData)
          .neq("status", "erledigt")
          .in("committee_id", committeeIds)
      : Promise.resolve({ data: [] as any[] }),
    committeeIds.length > 0
      ? service
          .from("shifts")
          .select("id, committee_id")
          .eq("organization_id", orgIdForData)
          .gte("date", todayStr)
          .in("committee_id", committeeIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const openTasksByTeam: Record<string, number> = {};
  for (const t of openTaskRows ?? []) {
    const cid = (t as any).committee_id as string;
    if (cid) openTasksByTeam[cid] = (openTasksByTeam[cid] ?? 0) + 1;
  }
  const upcomingShiftsByTeam: Record<string, number> = {};
  for (const s of upcomingShiftRows ?? []) {
    const cid = (s as any).committee_id as string;
    if (cid) upcomingShiftsByTeam[cid] = (upcomingShiftsByTeam[cid] ?? 0) + 1;
  }

  const committeesWithCounts = committeeList.map(
    (c: { id: string; name: string; description?: string | null; is_active?: boolean | null }) => ({
      ...c,
      memberCount: memberCountByCommittee[c.id] ?? 0,
      openTasks: openTasksByTeam[c.id] ?? 0,
      upcomingShifts: upcomingShiftsByTeam[c.id] ?? 0,
    })
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <AdminBreadcrumb orgSlug={orgSlug} currentLabel="Teams" />
          <h1 className="page-title">Teams</h1>
          <p className="page-sub">{org.name}</p>
        </div>
        <a href="#create-team" className="btn-primary shrink-0">
          + Neues Team
        </a>
      </header>

      {committeesWithCounts.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {committeesWithCounts.map((c: any) => (
            <CommitteeRow key={c.id} orgSlug={orgSlug} committee={c} />
          ))}
        </div>
      ) : (
        <div className="card p-4">
          <EmptyState messageKey="empty.teams" actionHref="#create-team" actionLabelKey="cta.create_team" />
        </div>
      )}

      <div id="create-team" className="card p-4">
        <div className="section-label">Neues Team</div>
        <CreateCommitteeForm orgSlug={orgSlug} orgId={org.id} committees={committeeList} />
      </div>
    </div>
  );
}

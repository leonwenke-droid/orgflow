import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentOrganization, getOrgIdForData, isOrgAdmin } from "../../../../lib/getOrganization";
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
    <div className="mx-auto max-w-4xl p-6">
      <AdminBreadcrumb orgSlug={orgSlug} currentLabel="Teams" />
      <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">Teams – {org.name}</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Create & edit (organisation)</p>

      <CreateCommitteeForm orgSlug={orgSlug} orgId={org.id} committees={committeeList} />

      <ul className="mt-6 space-y-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
        {committeesWithCounts.map(
          (c: {
            id: string;
            name: string;
            description?: string | null;
            is_active?: boolean | null;
            memberCount: number;
          }) => (
            <CommitteeRow key={c.id} orgSlug={orgSlug} committee={c} />
          )
        )}
        {(!committees || committees.length === 0) && (
          <li className="list-none">
            <EmptyState messageKey="empty.teams" actionHref={`/${orgSlug}/admin/committees`} actionLabelKey="cta.create_team" />
          </li>
        )}
      </ul>
    </div>
  );
}

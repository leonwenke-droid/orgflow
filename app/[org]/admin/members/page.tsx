import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentOrganization, isOrgAdmin, getOrgIdForData } from "../../../../lib/getOrganization";
import AdminBreadcrumb from "../../../../components/AdminBreadcrumb";
import AdminForbidden from "../AdminForbidden";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import MembersExcelUpload from "./MembersExcelUpload";
import AddMemberForm from "./AddMemberForm";
import MemberRow from "./MemberRow";
import InviteLinkBlock from "./InviteLinkBlock";
import EmptyState from "../../../../components/EmptyState";

export default async function AdminMembersPage({
  params
}: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const orgSlug = typeof (params as Promise<{ org: string }>).then === "function"
    ? (await (params as Promise<{ org: string }>)).org
    : (params as { org: string }).org;
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;

  const authClient = createServerComponentClient({ cookies });
  const {
    data: { session }
  } = await authClient.auth.getSession();
  const currentAuthUserId = session?.user?.id ?? null;

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseServiceRoleClient()
    : createServerComponentClient({ cookies });

  const { data: committees } = await supabase
    .from("committees")
    .select("id, name")
    .eq("organization_id", orgIdForData)
    .order("name");

  // Alle mit organization_id = orgIdForData; committee = primäres Komitee, role = Lead/Admin/Member, email/auth für Lead-Einladung
  const { data: orgMembers } = await supabase
    .from("profiles")
    .select("id, full_name, role, committee_id, email, auth_user_id, committee:committees!committee_id(name)")
    .eq("organization_id", orgIdForData)
    .order("full_name");

  const orgIds = new Set((orgMembers ?? []).map((m: { id: string }) => m.id));

  // Alle user_ids, die in engagement_scores für diese Org vorkommen
  const { data: scoresRows } = await supabase
    .from("engagement_scores")
    .select("user_id")
    .eq("organization_id", orgIdForData);

  const userIdsFromScores = [...new Set((scoresRows ?? []).map((r: { user_id: string }) => r.user_id))];
  const missingIds = userIdsFromScores.filter((id) => !orgIds.has(id));

  // Fehlende Profile nachladen und zur Liste hinzufügen
  let extraMembers: Array<{ id: string; full_name: string | null; committee: unknown }> = [];
  if (missingIds.length > 0) {
    const { data: extra } = await supabase
      .from("profiles")
      .select("id, full_name, role, committee_id, email, auth_user_id, committee:committees!committee_id(name)")
      .in("id", missingIds);
    extraMembers = (extra ?? []) as Array<{ id: string; full_name: string | null; role?: string; committee_id?: string | null; email?: string | null; auth_user_id?: string | null; committee: unknown }>;
  }

  const allMemberIds = [...(orgMembers ?? []), ...extraMembers].map((m: { id: string }) => m.id);
  const committeeIdsByMember: Record<string, string[]> = {};
  if (allMemberIds.length > 0) {
    const { data: pcRows } = await supabase
      .from("profile_committees")
      .select("user_id, committee_id")
      .in("user_id", allMemberIds);
    for (const row of pcRows ?? []) {
      const r = row as { user_id: string; committee_id: string };
      if (!committeeIdsByMember[r.user_id]) committeeIdsByMember[r.user_id] = [];
      committeeIdsByMember[r.user_id].push(r.committee_id);
    }
  }

  const members = [...(orgMembers ?? []), ...extraMembers]
    .map((m: { id: string; full_name?: string | null; committee_id?: string | null } & Record<string, unknown>) => ({
      ...m,
      committee_ids: [...new Set([
        ...(committeeIdsByMember[m.id] ?? []),
        ...(m.committee_id ? [m.committee_id] : [])
      ])]
    }))
    .sort((a, b) => ((a as { full_name?: string | null }).full_name ?? "").localeCompare((b as { full_name?: string | null }).full_name ?? ""));

  // Einladungsstatus bestimmen (nur wenn Service-Role verfügbar, damit wir Admin-API nutzen können)
  const inviteStatusByProfileId: Record<string, "pending" | "confirmed"> = {};
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && members.length > 0) {
    const authIds = members
      .map((m) => (m as { auth_user_id?: string | null }).auth_user_id)
      .filter((id): id is string => !!id);
    if (authIds.length > 0) {
      const adminClient = createSupabaseServiceRoleClient();
      const { data: listData } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000
      });
      const byId = new Map(
        (listData?.users ?? [])
          .filter((u) => u.id && authIds.includes(u.id))
          .map((u) => [u.id as string, (u as { email_confirmed_at?: string | null }).email_confirmed_at ?? null])
      );
      for (const m of members as Array<{ id: string; auth_user_id?: string | null }>) {
        if (!m.auth_user_id) continue;
        const confirmedAt = byId.get(m.auth_user_id);
        inviteStatusByProfileId[m.id] = confirmedAt ? "confirmed" : "pending";
      }
    }
  }

  const committeeList = (committees ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }));

  return (
    <div className="mx-auto max-w-4xl p-6">
      <AdminBreadcrumb orgSlug={orgSlug} currentLabel="Members" />
      <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-gray-100">Members – {org.name}</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Manage & import (organisation)</p>

      <div className="mt-6">
        <InviteLinkBlock orgSlug={orgSlug} />
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Excel import</h2>
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
          Download template, fill in (Name, optional Score, Teams, Leads), then upload here. Existing names are skipped.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <a
            href="/api/members-template"
            download="Members-Template.xlsx"
            className="text-sm text-blue-600 underline hover:text-blue-700"
          >
            Download template
          </a>
          <MembersExcelUpload orgSlug={orgSlug} />
        </div>
      </div>

      <div className="mt-6">
        <AddMemberForm orgSlug={orgSlug} committees={committeeList} />
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-card-dark">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-800">
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Name</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Teams</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Lead</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(members ?? []).map((m: any) => (
              <MemberRow
                key={m.id}
                orgSlug={orgSlug}
                member={m}
                committees={committeeList}
                currentAuthUserId={currentAuthUserId}
                inviteStatus={inviteStatusByProfileId[m.id]}
              />
            ))}
            {(!members || members.length === 0) && (
              <tr>
                <td colSpan={5} className="p-0">
                  <EmptyState messageKey="empty.members" actionHref={`/${orgSlug}/admin/members`} actionLabelKey="cta.invite_members" className="rounded-none border-0" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

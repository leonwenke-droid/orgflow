import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { getRequestLocale } from "../../../../lib/localeServer";
import { cookies } from "next/headers";
import {
  getCurrentOrganization,
  getCurrentUserRoleInOrg,
  getOrgIdForData,
  isOrgAdmin
} from "../../../../lib/getOrganization";
import { canManageMembersAndTeams } from "../../../../lib/permissions";
import AdminBreadcrumb from "../../../../components/AdminBreadcrumb";
import AdminForbidden from "../AdminForbidden";
import MembersExcelUpload from "./MembersExcelUpload";
import AddMemberForm from "./AddMemberForm";
import MemberRow from "./MemberRow";
import EmptyState from "../../../../components/EmptyState";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { t } from "../../../../lib/i18n";

const PAGE_SIZE = 25;

export default async function AdminMembersPage({
  params,
  searchParams
}: {
  params: Promise<{ org: string }> | { org: string };
  searchParams?: Promise<{ status?: string; q?: string; page?: string }> | { status?: string; q?: string; page?: string };
}) {
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

  const spRaw = searchParams;
  const statusParams =
    spRaw && typeof (spRaw as Promise<{ status?: string; q?: string; page?: string }>).then === "function"
      ? await (spRaw as Promise<{ status?: string; q?: string; page?: string }>)
      : ((spRaw as { status?: string; q?: string; page?: string } | undefined) ?? {});
  const statusFilter = (statusParams.status ?? "all").toLowerCase();
  const qRaw = (statusParams.q ?? "").trim();
  const qLower = qRaw.toLowerCase();
  const pageNum = Math.max(1, parseInt(String(statusParams.page ?? "1"), 10) || 1);

  const locale = await getRequestLocale();

  const authClient = createServerComponentClient({ cookies });
  const {
    data: { session }
  } = await authClient.auth.getSession();
  const currentAuthUserId = session?.user?.id ?? null;

  const supabase = createSupabaseServiceRoleClient();

  const { data: committees } = await supabase
    .from("committees")
    .select("id, name")
    .eq("organization_id", orgIdForData)
    .order("name");

  // Alle mit organization_id = orgIdForData; committee = primäres Komitee, role = Lead/Admin/Member, email/auth für Lead-Einladung
  const { data: orgMembers } = await supabase
    .from("profiles")
    .select("id, full_name, role, committee_id, email, auth_user_id, status, invite_status, invite_expires_at, committee:committees!committee_id(name)")
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
      .select("id, full_name, role, committee_id, email, auth_user_id, status, invite_status, invite_expires_at, committee:committees!committee_id(name)")
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
  const filteredMembers =
    statusFilter === "all"
      ? members
      : statusFilter === "invited"
        ? members.filter((m) => (m as { status?: string | null }).status === "invited" || (m as { invite_status?: string | null }).invite_status === "pending")
        : members.filter((m) => (m as { status?: string | null }).status === statusFilter);

  const searchedMembers = qLower
    ? filteredMembers.filter((m) =>
        String((m as { full_name?: string | null }).full_name ?? "")
          .toLowerCase()
          .includes(qLower)
      )
    : filteredMembers;

  const totalPages = Math.max(1, Math.ceil(searchedMembers.length / PAGE_SIZE));
  const safePage = Math.min(pageNum, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pagedMembers = searchedMembers.slice(start, start + PAGE_SIZE);

  const committeeList = (committees ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }));

  const queryBase = (page: number) => {
    const p = new URLSearchParams();
    p.set("status", statusFilter === "all" ? "all" : statusFilter);
    if (qRaw) p.set("q", qRaw);
    if (page > 1) p.set("page", String(page));
    const qs = p.toString();
    return qs ? `?${qs}` : "";
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <header>
        <AdminBreadcrumb orgSlug={orgSlug} currentLabel={t("members.page_title", locale)} />
        <h1 className="page-title">{t("members.page_title", locale)}</h1>
        <p className="page-sub">{org.name}</p>
      </header>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <form method="get" className="flex flex-1 flex-wrap items-center gap-2">
            <input type="hidden" name="status" value={statusFilter} />
            <input
              type="search"
              name="q"
              defaultValue={qRaw}
              placeholder={t("members.search_placeholder", locale)}
              className="w-full min-w-[220px] flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
            />
            <button type="submit" className="btn-secondary">{t("tasks.filter_search", locale)}</button>
          </form>
          <a href={`/api/member-invites/export?orgSlug=${encodeURIComponent(orgSlug)}`} className="btn-secondary">
            {t("members.download_pending", locale)}
          </a>
          <a href="#add-member" className="btn-primary">
            + {t("members.add_member_btn", locale)}
          </a>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(
            [
              ["all", "members.filter_all"],
              ["active", "members.filter_active"],
              ["invited", "members.filter_invited"],
              ["disabled", "members.filter_disabled"]
            ] as const
          ).map(([key, labelKey]) => (
            <a
              key={key}
              href={key === "all" ? (qRaw ? `?q=${encodeURIComponent(qRaw)}` : "?status=all") : `?status=${encodeURIComponent(key)}${qRaw ? `&q=${encodeURIComponent(qRaw)}` : ""}`}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                statusFilter === key ? "bg-white text-gray-900 shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-white/60 hover:text-gray-900"
              }`}
            >
              {t(labelKey, locale)}
            </a>
          ))}
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">{t("members.excel_import", locale)}</summary>
          <div className="mt-3 space-y-2">
            <p className="text-sm text-gray-600">{t("members.excel_import_hint", locale)}</p>
            <div className="flex flex-wrap items-center gap-3">
              <a href="/api/members-template" download="Members-Template.xlsx" className="text-sm text-brand hover:underline">
                {t("members.download_template", locale)}
              </a>
              <MembersExcelUpload orgSlug={orgSlug} />
            </div>
          </div>
        </details>
      </div>

      <div id="add-member" className="card p-4">
        <div className="section-label">{t("members.add_member_btn", locale)}</div>
        <AddMemberForm orgSlug={orgSlug} committees={committeeList} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {t("members.list_count", locale)
            .replace("{count}", String(searchedMembers.length))
            .replace("{page}", String(safePage))
            .replace("{total}", String(totalPages))}
        </p>
        <div className="flex gap-2">
          {safePage > 1 ? <a href={queryBase(safePage - 1)} className="btn-secondary">{t("members.page_prev", locale)}</a> : null}
          {safePage < totalPages ? <a href={queryBase(safePage + 1)} className="btn-secondary">{t("members.page_next", locale)}</a> : null}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="border-b border-gray-100">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("engagement.export_name", locale)}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("members.lead_column", locale)}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("dashboard.teams", locale)}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("common.actions", locale)}</th>
            </tr>
          </thead>
          <tbody>
            {pagedMembers.map((m: any) => (
              <MemberRow key={m.id} orgSlug={orgSlug} member={m} committees={committeeList} currentAuthUserId={currentAuthUserId} />
            ))}
            {(!pagedMembers || pagedMembers.length === 0) ? (
              <tr>
                <td colSpan={4} className="p-0">
                  <EmptyState messageKey="empty.members" actionHref={`/${orgSlug}/admin/members`} actionLabelKey="cta.invite_members" className="rounded-none border-0" />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

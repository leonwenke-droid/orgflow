import { cookies } from "next/headers";
import { getRequestLocale } from "../../../../../lib/localeServer";
import { getCurrentOrganization, isOrgAdmin, getOrgIdForData } from "../../../../../lib/getOrganization";
import { t } from "../../../../../lib/i18n";
import AdminBreadcrumb from "../../../../../components/AdminBreadcrumb";
import AdminForbidden from "../../AdminForbidden";
import AssignPointsForm from "./AssignPointsForm";
import ScoreImportLog from "./ScoreImportLog";
import { createSupabaseServiceRoleClient } from "../../../../../lib/supabaseServer";

export default async function AssignPointsPage({
  params
}: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const orgSlug = typeof (params as Promise<{ org: string }>).then === "function"
    ? (await (params as Promise<{ org: string }>)).org
    : (params as { org: string }).org;
  const locale = await getRequestLocale();
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  const orgFeatures = (org.settings?.features as Record<string, boolean> | undefined) ?? {};
  const engagementEnabled = (org as any).plan !== "free" && orgFeatures.engagement_tracking !== false;
  if (!engagementEnabled) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="card p-6">
          <h1 className="page-title">{t("common.access_denied", locale)}</h1>
        </div>
      </div>
    );
  }

  if (!(await isOrgAdmin(orgIdForData, orgSlug))) {
    return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;
  }

  const supabase = createSupabaseServiceRoleClient();

  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("organization_id", orgIdForData)
    .order("full_name");

  let logEntries: { id: string; user_id: string; recipientName: string; points: number; reason: string; created_at: string; createdBy: string; canRemove: boolean }[] = [];
  const { data: logRows, error: logErr } = await supabase
    .from("score_import_log")
    .select("id, user_id, points, reason, created_at, created_by, engagement_event_id")
    .eq("organization_id", orgIdForData)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!logErr && logRows) {
    const profileIds = new Set<string>();
    logRows.forEach((r: any) => {
      if (r.user_id) profileIds.add(r.user_id);
      if (r.created_by) profileIds.add(r.created_by);
    });
    const { data: logProfiles } = profileIds.size > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", Array.from(profileIds))
      : { data: [] };
    const nameMap = new Map((logProfiles ?? []).map((p: any) => [p.id, p.full_name ?? "–"]));

    logEntries = logRows.map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      recipientName: nameMap.get(row.user_id) ?? "–",
      points: row.points,
      reason: row.reason ?? "",
      created_at: row.created_at,
      createdBy: nameMap.get(row.created_by) ?? "–",
      canRemove: true
    }));
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6">
        <AdminBreadcrumb orgSlug={orgSlug} currentLabel={t("engagement.assign_breadcrumb", locale)} />
      </div>
      <h1 className="text-2xl font-bold text-text-primary dark:text-text-primary">
        {t("engagement.assign_title", locale)}
      </h1>
      <p className="mt-1 text-sm text-text-secondary dark:text-text-muted">
        {t("engagement.assign_intro", locale)}
      </p>
      <AssignPointsForm
        orgSlug={orgSlug}
        members={(members ?? []).map((m) => ({ id: m.id, full_name: m.full_name ?? "-" }))}
      />
      <ScoreImportLog entries={logEntries} orgSlug={orgSlug} />
    </div>
  );
}

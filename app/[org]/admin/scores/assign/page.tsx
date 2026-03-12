import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Link from "next/link";
import { getCurrentOrganization, isOrgAdmin } from "../../../../../lib/getOrganization";
import AdminBreadcrumb from "../../../../../components/AdminBreadcrumb";
import { createSupabaseServiceRoleClient } from "../../../../../lib/supabaseServer";
import AdminForbidden from "../../AdminForbidden";
import AssignPointsForm from "./AssignPointsForm";
import ScoreImportLog from "./ScoreImportLog";

export default async function AssignPointsPage({
  params
}: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const orgSlug = typeof (params as Promise<{ org: string }>).then === "function"
    ? (await (params as Promise<{ org: string }>)).org
    : (params as { org: string }).org;
  const org = await getCurrentOrganization(orgSlug);

  if (!(await isOrgAdmin(org.id))) {
    return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;
  }

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseServiceRoleClient()
    : createServerComponentClient({ cookies });

  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("organization_id", org.id)
    .order("full_name");

  let logEntries: { id: string; user_id: string; recipientName: string; points: number; reason: string; created_at: string; createdBy: string; canRemove: boolean }[] = [];
  const { data: logRows, error: logErr } = await supabase
    .from("score_import_log")
    .select("id, user_id, points, reason, created_at, created_by, engagement_event_id")
    .eq("organization_id", org.id)
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
        <AdminBreadcrumb orgSlug={orgSlug} currentLabel="Assign points" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900">
        Assign points individually
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Enter event or resource points for organisation members (e.g. event, material).
      </p>
      <AssignPointsForm
        orgSlug={orgSlug}
        members={(members ?? []).map((m) => ({ id: m.id, full_name: m.full_name ?? "-" }))}
      />
      <ScoreImportLog entries={logEntries} orgSlug={orgSlug} />
    </div>
  );
}

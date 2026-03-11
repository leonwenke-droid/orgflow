import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getCurrentOrganization, isOrgAdmin, getOrgIdForData } from "../../../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../../../lib/supabaseServer";

const TASK_EVENTS = ["task_done", "task_late", "task_missed"];
const SHIFT_EVENTS = ["shift_done", "shift_missed"];
const MATERIAL_EVENTS = ["material_small", "material_medium", "material_large"];

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ org: string }> }
) {
  const { org: orgSlug } = await context.params;
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const supabase = createSupabaseServiceRoleClient();

  const { data: scoresByOrg } = await supabase
    .from("engagement_scores")
    .select("user_id, score")
    .eq("organization_id", orgIdForData);

  const scoresByUser: Record<string, number> = {};
  const userIdsFromScores: string[] = [];
  for (const row of scoresByOrg ?? []) {
    const r = row as { user_id: string; score: number };
    scoresByUser[r.user_id] = r.score ?? 0;
    userIdsFromScores.push(r.user_id);
  }

  const { data: orgProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, committee:committees!committee_id(name)")
    .eq("organization_id", orgIdForData)
    .order("full_name");

  const orgProfileIds = new Set((orgProfiles ?? []).map((p: { id: string }) => p.id));
  const missingProfileIds = userIdsFromScores.filter((id) => !orgProfileIds.has(id));

  let extraProfiles: Array<{ id: string; full_name: string | null; committee: unknown }> = [];
  if (missingProfileIds.length > 0) {
    const { data: extra } = await supabase
      .from("profiles")
      .select("id, full_name, committee:committees!committee_id(name)")
      .in("id", missingProfileIds);
    extraProfiles = (extra ?? []) as Array<{ id: string; full_name: string | null; committee: unknown }>;
  }

  const combinedProfiles = [...(orgProfiles ?? []), ...extraProfiles];
  const allIds = combinedProfiles.map((p: { id: string }) => p.id);

  const missingScores = allIds.filter((id) => scoresByUser[id] === undefined);
  if (missingScores.length > 0) {
    const { data: byUser } = await supabase
      .from("engagement_scores")
      .select("user_id, score")
      .in("user_id", missingScores);
    for (const row of byUser ?? []) {
      const r = row as { user_id: string; score: number };
      scoresByUser[r.user_id] = r.score ?? 0;
    }
  }

  let eventsByUser: Record<string, { task_points: number; shift_points: number; material_points: number }> = {};
  if (allIds.length > 0) {
    const { data: events } = await supabase
      .from("engagement_events")
      .select("user_id, event_type, points")
      .in("user_id", allIds);
    const list = (events ?? []) as { user_id: string; event_type: string; points: number }[];
    for (const e of list) {
      if (!eventsByUser[e.user_id]) eventsByUser[e.user_id] = { task_points: 0, shift_points: 0, material_points: 0 };
      if (TASK_EVENTS.includes(e.event_type)) eventsByUser[e.user_id].task_points += e.points ?? 0;
      else if (SHIFT_EVENTS.includes(e.event_type)) eventsByUser[e.user_id].shift_points += e.points ?? 0;
      else if (MATERIAL_EVENTS.includes(e.event_type)) eventsByUser[e.user_id].material_points += e.points ?? 0;
    }
  }

  const { data: pcRows } = await supabase
    .from("profile_committees")
    .select("user_id, committee_id")
    .in("user_id", allIds);
  const { data: committees } = await supabase
    .from("committees")
    .select("id, name")
    .eq("organization_id", orgIdForData);
  const committeeNameById = new Map((committees ?? []).map((c: { id: string; name: string }) => [c.id, c.name ?? ""]));
  const committeeNamesByUser: Record<string, string> = {};
  for (const p of combinedProfiles) {
    const names = new Set<string>();
    const primaryName = (p.committee as { name?: string })?.name;
    if (primaryName) names.add(primaryName);
    for (const row of pcRows ?? []) {
      const r = row as { user_id: string; committee_id: string };
      if (r.user_id === p.id) {
        const n = committeeNameById.get(r.committee_id);
        if (n) names.add(n);
      }
    }
    committeeNamesByUser[p.id] = Array.from(names).join(", ");
  }

  const rows = combinedProfiles
    .map((p: any) => {
      const ev = eventsByUser[p.id];
      const total = scoresByUser[p.id] ?? 0;
      const committeeNames = (committeeNamesByUser[p.id] ?? (p.committee?.name ?? "")) || "–";
      return [
        (p.full_name ?? "").trim() || "–",
        committeeNames,
        ev?.task_points ?? 0,
        ev?.shift_points ?? 0,
        ev?.material_points ?? 0,
        total
      ];
    })
    .sort((a, b) => (b[5] as number) - (a[5] as number));

  const header = ["Rang", "Name", "Komitees", "Aufgaben-Punkte", "Schichten-Punkte", "Material-Punkte", "Gesamt-Score"];
  const rowsWithRank = rows.map((r, i) => [i + 1, ...r]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rowsWithRank]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Engagement Scores");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const filename = `Engagement-Scores-${orgSlug}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}

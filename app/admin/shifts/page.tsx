import { Suspense } from "react";
import { cookies } from "next/headers";
import { getRequestLocale } from "../../../lib/localeServer";
import Link from "next/link";
import { revalidatePath, unstable_noStore } from "next/cache";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { getCurrentOrganization, getCurrentUserOrganization, getOrgIdForData, isOrgAdmin } from "../../../lib/getOrganization";
import AdminBreadcrumb from "../../../components/AdminBreadcrumb";
import { removePastShifts } from "../../../lib/cleanupShifts";
import ShiftPlanTableWithEdit from "../../../components/ShiftPlanTableWithEdit";
import ShiftAttendancePdfExport, { type ShiftForPdf } from "../../../components/ShiftAttendancePdfExport";
import EmptyState from "../../../components/EmptyState";
import SubmitButtonWithSpinner from "../../../components/SubmitButtonWithSpinner";
import { t } from "../../../lib/i18n";
import { getTodayDateString } from "../../../lib/dateFormat";
import { isMissingSoftDeleteColumnError } from "../../../lib/supabaseSoftDelete";
import { requireOrgAdminAction } from "../../../lib/permissionsServer";
import { writeAuditLog } from "../../../lib/audit";
import RealtimeRefreshBridge from "../../../components/RealtimeRefreshBridge";
import ShiftTabFilter from "../../../components/shifts/ShiftTabFilter";
import ShiftTrashDropdown from "../../../components/shifts/ShiftTrashDropdown";
import ShiftsConsoleShell from "../../../components/shifts/ShiftsConsoleShell";
import ShiftsConsoleTabs from "../../../components/shifts/ShiftsConsoleTabs";
import { normalizeShiftsConsoleTab } from "../../../lib/shiftsConsoleTabs";
import ShiftsCalendarPanel from "../../../components/shifts/ShiftsCalendarPanel";
import NewShiftModal from "../../../components/shifts/NewShiftModal";
import MemberConsoleShiftsLoader from "../../../components/shifts/MemberConsoleShiftsLoader";
import ShiftsAttendanceConsole from "../../../components/shifts/ShiftsAttendanceConsole";
import ShiftsQrFlowTimeline from "../../../components/shifts/ShiftsQrFlowTimeline";
import ShiftsStatsPanel from "../../../components/shifts/ShiftsStatsPanel";
import ShiftsAutoAssignConfirmForm from "../../../components/shifts/ShiftsAutoAssignConfirmForm";
import { computeShiftConsoleStats, addCalendarDays } from "../../../lib/shiftStats";
import { filterShiftsByTime, type ShiftTimeFilter } from "../../../lib/shiftTimeFilter";
import {
  flagsFromAssignmentKind,
  parseAssignmentKind,
  parseAttendanceMode,
  type ShiftAssignmentKind
} from "../../../lib/shiftAssignmentKind";
import { qrFieldsForAttendanceMode, shiftQrValidityIso } from "../../../lib/shiftQr";
import { assignRotationFairOne, previewRotationForShift } from "../../../lib/actions/rotation";
import { addEngagementEvent } from "../../../lib/engagement/addEvent";
import { fetchEngagementEnabledForOrgId } from "../../../lib/engagement/isEngagementEnabled";

export const dynamic = "force-dynamic";

type SimpleShift = { id: string; required_slots: number | null; date?: string };

const COOLDOWN_DAYS = 3;

/**
 * Ermittelt User-IDs, die in den letzten COOLDOWN_DAYS vor shiftDate eine Schicht hatten.
 * Diese Personen dürfen an shiftDate keine weitere Schicht bekommen.
 */
async function getUsersInCooldown(
  service: ReturnType<typeof createSupabaseServiceRoleClient>,
  shiftDateStr: string
): Promise<Set<string>> {
  const shiftDate = new Date(shiftDateStr + "T12:00:00Z");
  const minD = new Date(shiftDate);
  minD.setUTCDate(minD.getUTCDate() - COOLDOWN_DAYS);
  const maxD = new Date(shiftDate);
  maxD.setUTCDate(maxD.getUTCDate() - 1);
  const minStr = minD.toISOString().slice(0, 10);
  const maxStr = maxD.toISOString().slice(0, 10);

  const { data: cooldownShifts } = await service
    .from("shifts")
    .select("id")
    .gte("date", minStr)
    .lte("date", maxStr);

  const shiftIds = (cooldownShifts ?? []).map((s: { id: string }) => s.id);
  if (shiftIds.length === 0) return new Set();

  const { data: assignments } = await service
    .from("shift_assignments")
    .select("user_id")
    .in("shift_id", shiftIds);

  return new Set(
    (assignments ?? []).map((a: { user_id: string }) => a.user_id as string)
  );
}

type MemberWithScore = { id: string; score: number };

/**
 * Wählt ohne Zurücklegen per gewichteter Zufall aus: geringerer Score = höhere Wahrscheinlichkeit.
 * Gewicht = (maxScore - score + 1), damit niemand 0-Chance hat und die Reihenfolge nicht aus der DB ablesbar ist.
 */
function weightedRandomSelect(
  eligible: MemberWithScore[],
  count: number
): MemberWithScore[] {
  const result: MemberWithScore[] = [];
  let pool = [...eligible];
  for (let n = 0; n < count && pool.length > 0; n++) {
    const maxScore = Math.max(...pool.map((m) => m.score));
    const weights = pool.map((m) => maxScore - m.score + 1);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalWeight;
    let idx = 0;
    for (; idx < pool.length; idx++) {
      r -= weights[idx];
      if (r <= 0) break;
    }
    idx = Math.min(idx, pool.length - 1);
    result.push(pool[idx]);
    pool = pool.slice(0, idx).concat(pool.slice(idx + 1));
  }
  return result;
}

/**
 * Auto-Zuteilung: Unter allen infrage kommenden Personen (nicht im Cooldown, noch nicht zugeteilt)
 * wird per gewichteter Zufall eingeteilt – geringerer Engagement-Score = höhere Wahrscheinlichkeit.
 * So ist die Einteilung fair (wenig engagierte werden eher dran genommen), aber nicht deterministisch.
 * globallyUsed verhindert Mehrfach-Zuteilung innerhalb derselben Batch.
 * Cooldown: Wer in den letzten 3 Tagen eine Schicht hatte, wird nicht erneut eingeteilt.
 * orgId: nur Personen dieses Jahrgangs berücksichtigen.
 */
async function autoAssignForShifts(
  service: ReturnType<typeof createSupabaseServiceRoleClient>,
  shifts: SimpleShift[],
  orgId: string | null
): Promise<{ assigned: number; total: number }> {
  if (!shifts.length) return { assigned: 0, total: 0 };

  const profilesQuery = service.from("profiles").select("id").order("full_name");
  if (orgId) profilesQuery.eq("organization_id", orgId);
  const scoresQuery = service.from("engagement_scores").select("user_id, score");
  if (orgId) scoresQuery.eq("organization_id", orgId);

  const [{ data: profiles }, { data: scores }] = await Promise.all([
    profilesQuery,
    scoresQuery
  ]);

  const scoreMap = new Map(
    (scores ?? []).map((s) => [s.user_id as string, Number(s.score) ?? 0])
  );
  const membersWithScore: MemberWithScore[] = (profiles ?? []).map((p) => ({
    id: p.id as string,
    score: scoreMap.get(p.id as string) ?? 0
  }));

  const globallyUsed = new Set<string>();

  for (const shift of shifts) {
    const required = shift.required_slots ?? 0;
    if (required <= 0) continue;

    const shiftDate = shift.date;
    const cooldownUsers =
      shiftDate != null
        ? await getUsersInCooldown(service, shiftDate)
        : new Set<string>();

    const { data: existing } = await service
      .from("shift_assignments")
      .select("user_id")
      .eq("shift_id", shift.id);
    const alreadyAssigned = new Set<string>(
      (existing ?? []).map((a: any) => a.user_id as string)
    );

    const eligible = membersWithScore.filter(
      (m) =>
        !alreadyAssigned.has(m.id) &&
        !globallyUsed.has(m.id) &&
        !cooldownUsers.has(m.id)
    );
    const toAssign = weightedRandomSelect(eligible, required);

    if (!toAssign.length) continue;

    const rows = toAssign.map((m) => ({
      shift_id: shift.id,
      user_id: m.id,
      status: "zugewiesen"
    }));

    const { error } = await service.from("shift_assignments").insert(rows);
    if (!error) {
      toAssign.forEach((m) => globallyUsed.add(m.id));
    }
  }

  return { assigned: globallyUsed.size, total: shifts.reduce((s, sh) => s + (sh.required_slots ?? 0), 0) };
}

async function runAutoAssignForExistingShifts(formData: FormData) {
  "use server";
  const orgId = formData.get("organization_id")?.toString() || null;
  const orgSlug = formData.get("org_slug")?.toString() || null;
  if (!orgId) return;

  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: adminOk } = await supabase.rpc("is_org_admin", { org_id: orgId });
  if (adminOk !== true) return;

  const service = createSupabaseServiceRoleClient();
  if (!(await fetchEngagementEnabledForOrgId(service, orgId))) {
    revalidatePath("/admin/shifts");
    if (orgSlug) revalidatePath(`/admin/shifts?org=${encodeURIComponent(orgSlug)}`);
    return;
  }

  // Nur Schichten mit Auto-Zuteilung — reine Selbsteintragungs-Schichten (claimable) nicht per Knopf füllen.
  const { data: shifts } = await service
    .from("shifts")
    .select("id, required_slots")
    .eq("organization_id", orgId)
    .eq("auto_assign", true)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  const shiftIds = (shifts ?? []).map((s: any) => s.id as string).filter(Boolean);
  if (shiftIds.length === 0) {
    revalidatePath("/admin/shifts");
    if (orgSlug) revalidatePath(`/admin/shifts?org=${encodeURIComponent(orgSlug)}`);
    return;
  }

  const { data: assignments } = await service
    .from("shift_assignments")
    .select("shift_id, user_id")
    .in("shift_id", shiftIds);

  const assignedByShift = new Map<string, Set<string>>();
  for (const a of assignments ?? []) {
    const sid = (a as any).shift_id as string;
    const uid = (a as any).user_id as string;
    if (!assignedByShift.has(sid)) assignedByShift.set(sid, new Set());
    assignedByShift.get(sid)!.add(uid);
  }

  const [{ data: profiles }, { data: counters }] = await Promise.all([
    service.from("profiles").select("id, role, status").eq("organization_id", orgId),
    service.from("user_counters").select("user_id, load_index, responsibility_malus")
  ]);

  const loadMap = new Map(
    (counters ?? []).map((c: any) => [
      c.user_id as string,
      { load: Number(c.load_index) ?? 0, malus: Number(c.responsibility_malus) ?? 0 }
    ])
  );

  const eligible = (profiles ?? [])
    .filter((p: any) => p.status !== "disabled" && p.role !== "viewer")
    .map((p: any) => {
      const c = loadMap.get(p.id as string) ?? { load: 0, malus: 0 };
      return { id: p.id as string, load: c.load, malus: c.malus };
    })
    .sort((a, b) => (a.load - b.load) || (a.malus - b.malus) || a.id.localeCompare(b.id));

  const usedThisRun = new Set<string>();
  const toInsert: { shift_id: string; user_id: string; status: string }[] = [];
  const increments = new Map<string, number>();

  for (const s of shifts ?? []) {
    const sid = (s as any).id as string;
    const required = Number((s as any).required_slots ?? 0) || 0;
    if (!sid || required <= 0) continue;
    const already = assignedByShift.get(sid) ?? new Set<string>();
    const missing = Math.max(0, required - already.size);
    if (missing <= 0) continue;

    let filled = 0;
    for (const m of eligible) {
      if (filled >= missing) break;
      if (already.has(m.id)) continue;
      if (usedThisRun.has(m.id)) continue;
      toInsert.push({ shift_id: sid, user_id: m.id, status: "zugewiesen" });
      usedThisRun.add(m.id);
      increments.set(m.id, (increments.get(m.id) ?? 0) + 1);
      filled++;
    }
  }

  if (toInsert.length > 0) {
    await service.from("shift_assignments").insert(toInsert);
    for (const [uid, inc] of increments.entries()) {
      const current = loadMap.get(uid)?.load ?? 0;
      await service
        .from("user_counters")
        .update({ load_index: current + inc, updated_at: new Date().toISOString() })
        .eq("user_id", uid);
    }
  }

  revalidatePath("/admin/shifts");
  if (orgSlug) revalidatePath(`/admin/shifts?org=${encodeURIComponent(orgSlug)}`);
}

type MemberFillRow = {
  id: string;
  score: number;
  full_name: string | null;
  last_rot: string | null;
};

function sortMembersForRotationFill(a: MemberFillRow, b: MemberFillRow): number {
  if (a.score !== b.score) return a.score - b.score;
  const aT = a.last_rot == null ? Number.NEGATIVE_INFINITY : new Date(a.last_rot).getTime();
  const bT = b.last_rot == null ? Number.NEGATIVE_INFINITY : new Date(b.last_rot).getTime();
  if (aT !== bT) return aT - bT;
  return (a.full_name ?? "").localeCompare(b.full_name ?? "", undefined, { sensitivity: "base" });
}

/**
 * Fills remaining slots on self-sign-up shifts (not enough members claimed).
 * Mode "auto": weighted random by engagement score (like batch auto-assign for new shifts).
 * Mode "rotation": lowest engagement score first, then rotation last_assigned_at (nulls first), then name.
 */
async function fillSelfSignupGaps(formData: FormData) {
  "use server";
  const orgId = formData.get("organization_id")?.toString() || null;
  const orgSlug = formData.get("org_slug")?.toString() || null;
  const mode = formData.get("mode")?.toString() === "rotation" ? "rotation" : "auto";
  if (!orgId) return;

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;

  const actor = await requireOrgAdminAction(orgId, orgSlug);
  if (!actor) return;

  const service = createSupabaseServiceRoleClient();
  if (!(await fetchEngagementEnabledForOrgId(service, orgId))) {
    revalidatePath("/admin/shifts");
    if (orgSlug) revalidatePath(`/admin/shifts?org=${encodeURIComponent(orgSlug)}`);
    return;
  }
  const todayStr = getTodayDateString();

  const { data: shifts } = await service
    .from("shifts")
    .select("id, required_slots, date")
    .eq("organization_id", orgId)
    .eq("assignment_kind", "self_signup")
    .is("deleted_at", null)
    .gte("date", todayStr)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  const shiftRows = (shifts ?? []) as { id: string; required_slots: number | null; date: string }[];
  if (shiftRows.length === 0) {
    revalidatePath("/admin/shifts");
    if (orgSlug) revalidatePath(`/admin/shifts?org=${encodeURIComponent(orgSlug)}`);
    return;
  }

  const shiftIds = shiftRows.map((s) => s.id);
  const { data: assignments } = await service
    .from("shift_assignments")
    .select("shift_id, user_id")
    .in("shift_id", shiftIds);

  const assignedByShift = new Map<string, Set<string>>();
  for (const a of assignments ?? []) {
    const sid = (a as { shift_id: string }).shift_id;
    const uid = (a as { user_id: string }).user_id;
    if (!assignedByShift.has(sid)) assignedByShift.set(sid, new Set());
    assignedByShift.get(sid)!.add(uid);
  }

  const [{ data: profiles }, { data: scores }, { data: rotScores }, { data: counters }] = await Promise.all([
    service.from("profiles").select("id, role, status, full_name").eq("organization_id", orgId),
    service.from("engagement_scores").select("user_id, score").eq("organization_id", orgId),
    service.from("rotation_scores").select("user_id, last_assigned_at").eq("organization_id", orgId),
    service.from("user_counters").select("user_id, load_index")
  ]);

  const scoreMap = new Map((scores ?? []).map((s: { user_id: string; score?: number | null }) => [s.user_id, Number(s.score) ?? 0]));
  const rotMap = new Map(
    (rotScores ?? []).map((r: { user_id: string; last_assigned_at?: string | null }) => [
      r.user_id,
      r.last_assigned_at ?? null
    ])
  );
  const loadMap = new Map(
    (counters ?? []).map((c: { user_id: string; load_index?: number | null }) => [
      c.user_id,
      Number(c.load_index) ?? 0
    ])
  );

  const members: MemberFillRow[] = (profiles ?? [])
    .filter((p: { status?: string | null; role?: string | null }) => p.status !== "disabled" && p.role !== "viewer")
    .map((p: { id: string; full_name?: string | null }) => ({
      id: p.id as string,
      score: scoreMap.get(p.id as string) ?? 0,
      full_name: (p.full_name as string | null) ?? null,
      last_rot: rotMap.get(p.id as string) ?? null
    }));

  const globallyUsed = new Set<string>();
  const toInsert: { shift_id: string; user_id: string; status: string }[] = [];
  const increments = new Map<string, number>();

  for (const shift of shiftRows) {
    const required = Math.max(1, Number(shift.required_slots ?? 1) || 1);
    const already = assignedByShift.get(shift.id) ?? new Set<string>();
    const missing = Math.max(0, required - already.size);
    if (missing <= 0) continue;

    const cooldownUsers = await getUsersInCooldown(service, shift.date);

    const eligible = members.filter(
      (m) => !already.has(m.id) && !globallyUsed.has(m.id) && !cooldownUsers.has(m.id)
    );
    if (eligible.length === 0) continue;

    let picked: { id: string }[] = [];
    if (mode === "auto") {
      picked = weightedRandomSelect(
        eligible.map((m) => ({ id: m.id, score: m.score })),
        missing
      );
    } else {
      const sorted = [...eligible].sort(sortMembersForRotationFill);
      picked = sorted.slice(0, missing).map((m) => ({ id: m.id }));
    }

    for (const p of picked) {
      toInsert.push({ shift_id: shift.id, user_id: p.id, status: "zugewiesen" });
      globallyUsed.add(p.id);
      increments.set(p.id, (increments.get(p.id) ?? 0) + 1);
    }
  }

  if (toInsert.length > 0) {
    await service.from("shift_assignments").insert(toInsert);
    for (const [uid, inc] of increments.entries()) {
      const current = loadMap.get(uid) ?? 0;
      await service
        .from("user_counters")
        .update({ load_index: current + inc, updated_at: new Date().toISOString() })
        .eq("user_id", uid);
    }
    await writeAuditLog({
      organizationId: orgId,
      actorProfileId: actor.actorProfileId,
      action: "shift.fill_self_signup_gaps",
      targetTable: "shift_assignments",
      metadata: { mode, inserted: toInsert.length }
    });
  }

  revalidatePath("/admin/shifts");
  if (orgSlug) revalidatePath(`/admin/shifts?org=${encodeURIComponent(orgSlug)}`);
}

async function resolveShiftOrganizationId(shiftId: string): Promise<string | null> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service.from("shifts").select("organization_id").eq("id", shiftId).maybeSingle();
  return (data as { organization_id?: string | null } | null)?.organization_id ?? null;
}

async function resolveAssignmentOrganizationId(assignmentId: string): Promise<string | null> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("shift_assignments")
    .select("shifts(organization_id)")
    .eq("id", assignmentId)
    .maybeSingle();
  const row = data as { shifts?: { organization_id?: string | null } | null } | null;
  return row?.shifts?.organization_id ?? null;
}

async function createShifts(
  _prev: { error?: string; errorKey?: string } | null,
  formData: FormData
): Promise<{ error?: string; errorKey?: string; success?: boolean }> {
  "use server";
  try {
    const rawType = formData.get("type")?.toString() || "recurring";
    const type = rawType === "recurring" ? "pausenverkauf" : rawType;
    const date = formData.get("date")?.toString();
    const eventName = formData.get("event_name")?.toString().trim() || "";
    const startTime = formData.get("start_time")?.toString() || "";
    const endTime = formData.get("end_time")?.toString() || "";
    const location = formData.get("location")?.toString().trim() || null;
    const notes = formData.get("notes")?.toString().trim() || null;
    const requiredSlotsRaw = Number(formData.get("required_slots")?.toString() || "0");
    const requiredSlots = Number.isFinite(requiredSlotsRaw) ? Math.max(1, Math.floor(requiredSlotsRaw)) : 1;
    const organizationId = formData.get("organization_id")?.toString() || null;
    const formOrgSlug = formData.get("org_slug")?.toString().trim() || null;
    const eventId = formData.get("event_id")?.toString().trim() || null;
    const rawKind = formData.get("assignment_kind")?.toString();
    const legacyMode = formData.get("assignment_mode")?.toString();
    const assignmentKind: ShiftAssignmentKind = parseAssignmentKind(
      rawKind || (legacyMode === "auto" ? "auto_assign" : "self_signup")
    );
    const { claimable, auto_assign: autoAssignFlag } = flagsFromAssignmentKind(assignmentKind);
    const autoAssign = assignmentKind === "auto_assign";
    const attendanceMode = parseAttendanceMode(formData.get("attendance_mode")?.toString());

    if (!date) {
      return { error: "Date required.", errorKey: "shifts.date_required" };
    }
    if (!eventName) {
      return { error: "Title required.", errorKey: "shifts.title_required" };
    }

    if (!organizationId) return { errorKey: "common.unauthorized" };
    const actor = await requireOrgAdminAction(organizationId, formOrgSlug);
    if (!actor) return { errorKey: "common.unauthorized" };

    const supabase = createServerComponentClient({ cookies });
    const {
      data: { user }
    } = await supabase.auth.getUser();
    const service = createSupabaseServiceRoleClient();

    // created_by muss profiles.id sein, nicht auth user id
    let createdBy: string | null = null;
    if (user?.id) {
      const { data: profile } = await service
        .from("profiles")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      createdBy = profile?.id ?? null;
    }

    const baseRow = (
      overrides: Partial<{
        event_name: string;
        date: string;
        start_time: string;
        end_time: string;
        location: string | null;
        notes: string | null;
        created_by: string | null;
        required_slots: number;
        event_id: string | null;
      }>
    ) => {
      const st = overrides.start_time ?? "";
      const et = overrides.end_time ?? "";
      const qr =
        st && et ? qrFieldsForAttendanceMode(attendanceMode, date, st, et) : { qr_token: null, qr_valid_from: null, qr_valid_until: null };
      return {
        event_name: "",
        date,
        start_time: "",
        end_time: "",
        location,
        notes,
        created_by: createdBy,
        required_slots: requiredSlots,
        auto_assign: autoAssignFlag,
        claimable,
        assignment_kind: assignmentKind,
        attendance_mode: attendanceMode,
        ...qr,
        ...(eventId ? { event_id: eventId } : {}),
        ...overrides,
        ...(organizationId ? { organization_id: organizationId } : {})
      };
    };

    if (type === "pausenverkauf") {
      const rows = [
        baseRow({ event_name: `${eventName} – 1. Pause`, start_time: "09:15", end_time: "09:35" }),
        baseRow({ event_name: `${eventName} – 2. Pause`, start_time: "11:05", end_time: "11:30" })
      ];
      const { data: created, error } = await service
        .from("shifts")
        .insert(rows)
        .select("id, required_slots, date");
      if (error || !created?.length) {
        console.error(error);
        return {
          error: error?.message ?? undefined,
          errorKey: "shifts.error_create",
        };
      }
      // Nur bei Modus „Auto-Zuteilung“ sofort Personen eintragen — nicht bei Selbsteintragung (claim).
      if (autoAssign) {
        await autoAssignForShifts(service, created as SimpleShift[], organizationId);
      }
    } else {
      if (!startTime || !endTime) {
        return { errorKey: "shifts.error_timeframe" };
      }
      const hhmmPattern = /^([01]\d|2[0-3]):[0-5]\d$/;
      if (!hhmmPattern.test(startTime) || !hhmmPattern.test(endTime)) {
        return { error: "Ungueltiges Zeitformat." };
      }
      const intervalMinutes = Math.max(1, Number(formData.get("interval_minutes")?.toString() || "120") || 120);
      const addSetupTeardown = formData.get("add_setup_teardown") === "1";

      const toMinutes = (hhmm: string) => {
        const [h, m] = hhmm.split(":").map(Number);
        return (h ?? 0) * 60 + (m ?? 0);
      };
      const toHHMM = (minutes: number) => {
        const h = Math.floor(minutes / 60) % 24;
        const m = minutes % 60;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      };

      const startMin = toMinutes(startTime);
      const endMin = toMinutes(endTime);
      if (endMin <= startMin) {
        return { error: "Endzeit muss nach der Startzeit liegen." };
      }

      const rows: Record<string, unknown>[] = [];
      let slotStart = startMin;
      const slotTimes: { start: number; end: number }[] = [];
      while (slotStart < endMin) {
        const slotEnd = Math.min(slotStart + intervalMinutes, endMin);
        slotTimes.push({ start: slotStart, end: slotEnd });
        slotStart = slotEnd;
      }

      const firstSlotStart = addSetupTeardown && slotTimes[0]?.start - 30 >= 0
        ? slotTimes[0].start - 30
        : slotTimes[0]?.start ?? startMin;
      const lastSlotEnd = addSetupTeardown && slotTimes.length > 0 && (slotTimes[slotTimes.length - 1]?.end ?? endMin) + 30 <= 24 * 60
        ? (slotTimes[slotTimes.length - 1]?.end ?? endMin) + 30
        : slotTimes[slotTimes.length - 1]?.end ?? endMin;

      for (let i = 0; i < slotTimes.length; i++) {
        const { start, end } = slotTimes[i];
        const isFirst = i === 0;
        const isLast = i === slotTimes.length - 1;
        const effectiveStart = isFirst ? firstSlotStart : start;
        const effectiveEnd = isLast ? lastSlotEnd : end;
        const hasAufbau = addSetupTeardown && isFirst && firstSlotStart < start;
        const hasAbbau = addSetupTeardown && isLast && lastSlotEnd > end;

        const stSlot = toHHMM(effectiveStart);
        const etSlot = toHHMM(effectiveEnd);
        const logicalSt = toHHMM(start);
        const logicalEt = toHHMM(end);
        const displayTitle =
          slotTimes.length > 1 ? `${eventName} – ${logicalSt}–${logicalEt}` : eventName;
        rows.push({
          event_name: displayTitle,
          date,
          start_time: stSlot,
          end_time: etSlot,
          location,
          notes,
          created_by: createdBy,
          required_slots: requiredSlots,
          has_aufbau: hasAufbau,
          has_abbau: hasAbbau,
          auto_assign: autoAssignFlag,
          claimable,
          assignment_kind: assignmentKind,
          attendance_mode: attendanceMode,
          ...qrFieldsForAttendanceMode(attendanceMode, date, stSlot, etSlot),
          ...(eventId ? { event_id: eventId } : {}),
          ...(organizationId ? { organization_id: organizationId } : {})
        });
      }

      const { data: created, error } = await service
        .from("shifts")
        .insert(rows)
        .select("id, required_slots, date");
      if (error || !created?.length) {
        console.error(error);
        return {
          error: error?.message ?? undefined,
          errorKey: "shifts.error_create",
        };
      }
      if (autoAssign) {
        await autoAssignForShifts(service, created as SimpleShift[], organizationId);
      }
    }

    revalidatePath("/admin/shifts");
    await writeAuditLog({
      organizationId,
      actorProfileId: actor.actorProfileId,
      action: "shift.created_batch",
      targetTable: "shifts",
      metadata: { type, autoAssign }
    });
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unbekannter Fehler.";
    return { error: message };
  }
}

async function assignToShift(shiftId: string, formData: FormData) {
  "use server";
  const userId = formData.get("user_id")?.toString();
  if (!userId) return;
  const organizationId = await resolveShiftOrganizationId(shiftId);
  if (!organizationId) return;
  const actor = await requireOrgAdminAction(organizationId);
  if (!actor) return;
  const service = createSupabaseServiceRoleClient();
  const { error } = await service.from("shift_assignments").insert({
    shift_id: shiftId,
    user_id: userId,
    status: "zugewiesen"
  });
  if (!error) {
    await writeAuditLog({
      organizationId,
      actorProfileId: actor.actorProfileId,
      action: "shift.assignment_added",
      targetTable: "shift_assignments",
      targetId: shiftId,
      metadata: { userId }
    });
    revalidatePath("/admin/shifts");
  }
}

async function updateShift(shiftId: string, formData: FormData) {
  "use server";
  const eventName = formData.get("event_name")?.toString().trim();
  const date = formData.get("date")?.toString();
  const startTime = formData.get("start_time")?.toString();
  const endTime = formData.get("end_time")?.toString();
  const location = formData.get("location")?.toString().trim() || null;
  const notes = formData.get("notes")?.toString().trim() || null;
  const kindRaw = formData.get("assignment_kind")?.toString();
  const attendanceRaw = formData.get("attendance_mode")?.toString();

  if (!eventName || !date || !startTime || !endTime) return;
  const organizationId = await resolveShiftOrganizationId(shiftId);
  if (!organizationId) return;
  const actor = await requireOrgAdminAction(organizationId);
  if (!actor) return;

  const assignmentKind = kindRaw ? parseAssignmentKind(kindRaw) : null;
  const flags = assignmentKind ? flagsFromAssignmentKind(assignmentKind) : null;
  const attendanceMode = attendanceRaw ? parseAttendanceMode(attendanceRaw) : null;

  const service = createSupabaseServiceRoleClient();
  const { data: existingShift } = await service
    .from("shifts")
    .select("qr_token, attendance_mode")
    .eq("id", shiftId)
    .maybeSingle();
  const effectiveAttendanceMode = attendanceRaw
    ? parseAttendanceMode(attendanceRaw)
    : parseAttendanceMode(String((existingShift as { attendance_mode?: string } | null)?.attendance_mode ?? "qr"));
  const qrPart =
    effectiveAttendanceMode === "qr" && (existingShift as { qr_token?: string | null } | null)?.qr_token
      ? (() => {
          const w = shiftQrValidityIso(date, startTime, endTime);
          return {
            qr_token: (existingShift as { qr_token: string }).qr_token,
            qr_valid_from: w.qr_valid_from,
            qr_valid_until: w.qr_valid_until
          };
        })()
      : qrFieldsForAttendanceMode(effectiveAttendanceMode, date, startTime, endTime);

  const payload: Record<string, unknown> = {
    event_name: eventName,
    date,
    start_time: startTime,
    end_time: endTime,
    location,
    notes,
    ...qrPart
  };
  if (assignmentKind && flags) {
    payload.assignment_kind = assignmentKind;
    payload.claimable = flags.claimable;
    payload.auto_assign = flags.auto_assign;
  }
  if (attendanceMode) {
    payload.attendance_mode = attendanceMode;
  }

  const { error } = await service.from("shifts").update(payload).eq("id", shiftId);

  if (!error) {
    await writeAuditLog({
      organizationId,
      actorProfileId: actor.actorProfileId,
      action: "shift.updated",
      targetTable: "shifts",
      targetId: shiftId
    });
    revalidatePath("/admin/shifts");
    revalidatePath("/dashboard", "layout");
  }
}

/** Erhält Schicht-Suffix (z. B. " – 1. Pause") aus event_name, damit nur der Veranstaltungsname geändert wird. */
function getEventNameSuffix(eventName: string): string {
  const i = String(eventName ?? "").trim().indexOf(" – ");
  return i >= 0 ? String(eventName).slice(i) : "";
}

/** Veranstaltung bearbeiten: gilt für alle Schichten. Nur der Basis-Name (Veranstaltung) wird geändert, Schichtnamen wie "1. Pause" bleiben. */
async function updateEventGroup(shiftIds: string[], formData: FormData) {
  "use server";
  const newBaseName = formData.get("event_name")?.toString().trim();
  const date = formData.get("date")?.toString();
  const startTime = formData.get("start_time")?.toString();
  const endTime = formData.get("end_time")?.toString();
  const location = formData.get("location")?.toString().trim() || null;
  const notes = formData.get("notes")?.toString().trim() || null;
  if (!newBaseName || !date || !shiftIds?.length) return;
  const orgForCheck = await resolveShiftOrganizationId(shiftIds[0]);
  if (!orgForCheck) return;
  const actor = await requireOrgAdminAction(orgForCheck);
  if (!actor) return;

  const service = createSupabaseServiceRoleClient();
  const { data: shifts } = await service
    .from("shifts")
    .select("id, event_name")
    .in("id", shiftIds);
  if (!shifts?.length) return;

  const [first, ...rest] = shifts as { id: string; event_name: string }[];
  const firstPayload: Record<string, unknown> = {
    event_name: newBaseName + getEventNameSuffix(first.event_name),
    date,
    location,
    notes
  };
  if (startTime && endTime) {
    firstPayload.start_time = startTime;
    firstPayload.end_time = endTime;
  }
  const { error: errFirst } = await service
    .from("shifts")
    .update(firstPayload)
    .eq("id", first.id);
  if (errFirst) return;

  for (const s of rest) {
    await service
      .from("shifts")
      .update({
        event_name: newBaseName + getEventNameSuffix(s.event_name),
        date,
        location,
        notes
      })
      .eq("id", s.id);
  }
  revalidatePath("/admin/shifts");
  revalidatePath("/dashboard", "layout");
  await writeAuditLog({
    organizationId: orgForCheck,
    actorProfileId: actor.actorProfileId,
    action: "shift.event_group_updated",
    targetTable: "shifts",
    metadata: { count: shiftIds.length }
  });
}

async function removeAssignment(assignmentId: string) {
  "use server";
  const organizationId = await resolveAssignmentOrganizationId(assignmentId);
  if (!organizationId) return;
  const actor = await requireOrgAdminAction(organizationId);
  if (!actor) return;
  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("shift_assignments")
    .delete()
    .eq("id", assignmentId);

  if (!error) {
    await writeAuditLog({
      organizationId,
      actorProfileId: actor.actorProfileId,
      action: "shift.assignment_removed",
      targetTable: "shift_assignments",
      targetId: assignmentId
    });
    revalidatePath("/admin/shifts");
    revalidatePath("/dashboard");
  }
}

async function replaceAssignment(assignmentId: string, formData: FormData) {
  "use server";
  const newUserId = formData.get("user_id")?.toString();
  if (!newUserId) return;
  const organizationId = await resolveAssignmentOrganizationId(assignmentId);
  if (!organizationId) return;
  const actor = await requireOrgAdminAction(organizationId);
  if (!actor) return;

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("shift_assignments")
    .update({ user_id: newUserId })
    .eq("id", assignmentId);

  if (!error) {
    await writeAuditLog({
      organizationId,
      actorProfileId: actor.actorProfileId,
      action: "shift.assignment_replaced",
      targetTable: "shift_assignments",
      targetId: assignmentId,
      metadata: { newUserId }
    });
    revalidatePath("/admin/shifts");
    revalidatePath("/dashboard");
  }
}

const SHIFT_DONE_POINTS = 10;
const SHIFT_DONE_BONUS_AUFBAU = 5;
const SHIFT_DONE_BONUS_ABBAU = 5;
const SHIFT_MISSED_PENALTY = -15; // Nicht angetreten, kein Ersatz (kein Becheid)

async function getShiftDonePoints(
  service: ReturnType<typeof createSupabaseServiceRoleClient>,
  shiftId: string
): Promise<number> {
  const { data: shift } = await service
    .from("shifts")
    .select("has_aufbau, has_abbau")
    .eq("id", shiftId)
    .single();
  if (!shift) return SHIFT_DONE_POINTS;
  const bonus = (shift.has_aufbau ? SHIFT_DONE_BONUS_AUFBAU : 0) + (shift.has_abbau ? SHIFT_DONE_BONUS_ABBAU : 0);
  return SHIFT_DONE_POINTS + bonus;
}

/** Zugewiesene Person ist angetreten → Status erledigt, Trigger vergibt shift_done. */
async function markAssignmentAttended(assignmentId: string) {
  "use server";
  const organizationId = await resolveAssignmentOrganizationId(assignmentId);
  if (!organizationId) return;
  const actor = await requireOrgAdminAction(organizationId);
  if (!actor) return;
  const service = createSupabaseServiceRoleClient();
  const nowIso = new Date().toISOString();
  const { error } = await service
    .from("shift_assignments")
    .update({
      status: "erledigt",
      checked_in_at: nowIso,
      checked_in_by: actor.actorProfileId,
      check_in_method: "manual",
      attendance_status: "present"
    })
    .eq("id", assignmentId);
  if (!error) {
    await writeAuditLog({
      organizationId,
      actorProfileId: actor.actorProfileId,
      action: "shift.assignment_status_updated",
      targetTable: "shift_assignments",
      targetId: assignmentId,
      metadata: { status: "erledigt", checkedIn: true }
    });
    revalidatePath("/admin/shifts");
    revalidatePath("/dashboard");
  }
}

/** Zugewiesene Person nicht angetreten. Mit Ersatz: Original keine Punkte, Ersatz +volle Punkte. Ohne Ersatz: Abzug (kein Becheid). */
async function markAssignmentNotAttended(
  assignmentId: string,
  replacementUserId: string | null
) {
  "use server";
  const organizationId = await resolveAssignmentOrganizationId(assignmentId);
  if (!organizationId) return;
  const actor = await requireOrgAdminAction(organizationId);
  if (!actor) return;
  const service = createSupabaseServiceRoleClient();
  const engagementEnabled = await fetchEngagementEnabledForOrgId(service, organizationId);
  const { data: assignment } = await service
    .from("shift_assignments")
    .select("user_id, shift_id")
    .eq("id", assignmentId)
    .single();
  if (!assignment?.user_id) return;

  const { error: updateErr } = await service
    .from("shift_assignments")
    .update({
      status: "abgesagt",
      replacement_user_id: replacementUserId || null,
      attendance_status: "absent",
      checked_in_at: null,
      check_in_method: null
    })
    .eq("id", assignmentId);
  if (updateErr) return;

  const originalUserId = assignment.user_id as string;
  const shiftIdStr = assignment.shift_id as string;
  if (engagementEnabled) {
    if (replacementUserId) {
      const points = await getShiftDonePoints(service, shiftIdStr);
      await addEngagementEvent(service, {
        userId: replacementUserId,
        organizationId: organizationId,
        eventType: "shift_done",
        points,
        sourceId: assignmentId,
        shiftId: shiftIdStr
      });
    } else {
      await addEngagementEvent(service, {
        userId: originalUserId,
        organizationId: organizationId,
        eventType: "shift_missed",
        points: SHIFT_MISSED_PENALTY,
        sourceId: assignmentId,
        shiftId: shiftIdStr
      });
    }
  }
  revalidatePath("/admin/shifts");
  revalidatePath("/dashboard");
  await writeAuditLog({
    organizationId,
    actorProfileId: actor.actorProfileId,
    action: "shift.assignment_status_updated",
    targetTable: "shift_assignments",
    targetId: assignmentId,
    metadata: { status: "abgesagt", replacementUserId }
  });
}

/** Status nachträglich ändern (z. B. von erledigt auf nicht angetreten). Entfernt alte Engagement-Einträge, setzt neuen Status, Trigger/App setzen Scores. */
async function updateAssignmentStatus(
  assignmentId: string,
  status: "erledigt" | "abgesagt",
  replacementUserId: string | null
) {
  "use server";
  const organizationId = await resolveAssignmentOrganizationId(assignmentId);
  if (!organizationId) return;
  const actor = await requireOrgAdminAction(organizationId);
  if (!actor) return;
  const service = createSupabaseServiceRoleClient();
  const engagementEnabled = await fetchEngagementEnabledForOrgId(service, organizationId);
  const { data: assignment } = await service
    .from("shift_assignments")
    .select("user_id, shift_id")
    .eq("id", assignmentId)
    .single();
  if (!assignment?.user_id) return;

  if (engagementEnabled) {
    await service.from("engagement_events").delete().eq("source_id", assignmentId);
  }

  const { error: updateErr } = await service
    .from("shift_assignments")
    .update({
      status,
      replacement_user_id: status === "abgesagt" ? replacementUserId : null
    })
    .eq("id", assignmentId);
  if (updateErr) return;

  const originalUserId = assignment.user_id as string;
  const shiftIdForEv = assignment.shift_id as string;
  if (engagementEnabled && status === "abgesagt") {
    if (replacementUserId) {
      const points = await getShiftDonePoints(service, shiftIdForEv);
      await addEngagementEvent(service, {
        userId: replacementUserId,
        organizationId: organizationId,
        eventType: "shift_done",
        points,
        sourceId: assignmentId,
        shiftId: shiftIdForEv
      });
    } else {
      await addEngagementEvent(service, {
        userId: originalUserId,
        organizationId: organizationId,
        eventType: "shift_missed",
        points: SHIFT_MISSED_PENALTY,
        sourceId: assignmentId,
        shiftId: shiftIdForEv
      });
    }
  }
  revalidatePath("/admin/shifts");
  revalidatePath("/dashboard");
  await writeAuditLog({
    organizationId,
    actorProfileId: actor.actorProfileId,
    action: "shift.assignment_status_updated",
    targetTable: "shift_assignments",
    targetId: assignmentId,
    metadata: { status, replacementUserId }
  });
}

async function deleteShift(formData: FormData) {
  "use server";
  const shiftId = formData.get("shiftId")?.toString();
  if (!shiftId) return;
  const organizationId = await resolveShiftOrganizationId(shiftId);
  if (!organizationId) return;
  const actor = await requireOrgAdminAction(organizationId);
  if (!actor) return;
  const service = createSupabaseServiceRoleClient();
  await service.from("shift_assignments").delete().eq("shift_id", shiftId);
  await service
    .from("shifts")
    .update({ deleted_at: new Date().toISOString(), deleted_by: actor.actorProfileId })
    .eq("id", shiftId);
  await writeAuditLog({
    organizationId,
    actorProfileId: actor.actorProfileId,
    action: "shift.soft_deleted",
    targetTable: "shifts",
    targetId: shiftId
  });
  revalidatePath("/admin/shifts");
  revalidatePath("/dashboard");
}

type ShiftsPageProps = {
  searchParams?:
    | Promise<{ org?: string; event?: string; success?: string; view?: string; tab?: string }>
    | { org?: string; event?: string; success?: string; view?: string; tab?: string };
};

export default async function ShiftsPage(props: ShiftsPageProps) {
  unstable_noStore();
  const raw = props.searchParams;
  const [locale, searchParams] = await Promise.all([
    getRequestLocale(),
    raw && typeof (raw as Promise<unknown>).then === "function"
      ? (raw as Promise<{ org?: string; event?: string; success?: string; view?: string; tab?: string }>)
      : Promise.resolve(
          (raw ?? {}) as { org?: string; event?: string; success?: string; view?: string; tab?: string }
        )
  ]);
  const orgSlug = searchParams?.org?.trim() || null;
  const eventIdFilter = searchParams?.event?.trim() || null;
  const shiftsCreatedSuccess = searchParams?.success === "1";
  const timeFilter = ((searchParams as Record<string, string | undefined>)?.time ?? "all") as ShiftTimeFilter;
  const sp = searchParams as Record<string, string | undefined>;
  let activeTab = normalizeShiftsConsoleTab(sp?.tab);
  if (!sp?.tab && sp?.view === "calendar") activeTab = "cal";

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const userId = user?.id;

  if (!userId) {
    const loginHref = orgSlug ? `/${orgSlug}/login` : "/";
    return (
      <p className="text-sm text-amber-300 dark:text-amber-200">
        {t("tasks.session_missing", locale)}{" "}
        <a href={loginHref} className="underline">{t("common.sign_in", locale)}</a>.
      </p>
    );
  }

  const service = createSupabaseServiceRoleClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id, role, organization_id")
    .eq("auth_user_id", userId)
    .single();

  if (!profile || !["admin", "lead", "super_admin", "owner", "teamlead"].includes(profile.role)) {
    return (
      <p className="text-sm text-red-300 dark:text-red-200">
        {t("tasks.access_admin_only", locale)}
      </p>
    );
  }

  let orgId: string | null = null;
  if (orgSlug) {
    try {
      const org = await getCurrentOrganization(orgSlug);
      const orgIdForData = getOrgIdForData(orgSlug, org.id);
      if (await isOrgAdmin(orgIdForData, orgSlug)) orgId = orgIdForData;
    } catch {
      orgId = null;
    }
  }
  if (!orgId && profile.organization_id) orgId = profile.organization_id;

  let organizationName: string | null = null;
  let engagementEnabled = false;
  if (orgId) {
    const { data: orgNameRow } = await service
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .maybeSingle();
    organizationName = (orgNameRow as { name?: string | null } | null)?.name?.trim() || null;
    engagementEnabled = await fetchEngagementEnabledForOrgId(service, orgId);
  }

  let effectiveOrgSlug = orgSlug;
  if (!effectiveOrgSlug && orgId) {
    const userOrg = await getCurrentUserOrganization();
    effectiveOrgSlug = userOrg?.slug ?? null;
  }

  await removePastShifts(service);

  const todayStr = getTodayDateString();

  const SHIFT_SELECT =
    "id, event_name, date, start_time, end_time, location, notes, has_aufbau, has_abbau, required_slots, auto_assign, claimable, assignment_kind, attendance_mode, event_id, qr_token, qr_valid_from, qr_valid_until";

  function buildShiftsQuery(includeDeletedFilter: boolean) {
    let q = service
      .from("shifts")
      .select(SHIFT_SELECT)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });
    if (orgId) {
      q = q.eq("organization_id", orgId);
    }
    if (eventIdFilter) {
      q = q.eq("event_id", eventIdFilter);
    }
    if (includeDeletedFilter) {
      q = q.is("deleted_at", null);
    }
    return q;
  }

  let shiftsRes = await buildShiftsQuery(true);
  if (shiftsRes.error && isMissingSoftDeleteColumnError(shiftsRes.error.message)) {
    shiftsRes = await buildShiftsQuery(false);
  }
  const shiftsRaw = shiftsRes.data;
  const shiftsError =
    shiftsRes.error && !isMissingSoftDeleteColumnError(shiftsRes.error.message) ? shiftsRes.error : null;

  const profilesQuery = service.from("profiles").select("id, full_name, role").order("full_name");
  const eventsQuery = orgId
    ? service.from("events").select("id, name").eq("organization_id", orgId).order("name")
    : Promise.resolve({ data: [] as { id: string; name: string }[] });
  if (orgId) {
    profilesQuery.eq("organization_id", orgId);
  }

  const [{ data: assignmentsRaw }, { data: profiles }, { data: counters }, { data: eventsList }] = await Promise.all([
    service
      .from("shift_assignments")
      .select("id, shift_id, status, user_id, replacement_user_id, checked_in_at, check_in_method, attendance_status"),
    profilesQuery,
    service.from("user_counters").select("user_id, load_index, responsibility_malus"),
    eventsQuery
  ]);
  const events = (eventsList ?? []).map((e: { id: string; name: string }) => ({ id: e.id, name: e.name }));

  const assignmentsByShift = new Map<
    string,
    {
      id: string;
      status: string;
      user_id: string;
      replacement_user_id: string | null;
      checked_in_at: string | null;
      check_in_method: string | null;
      attendance_status: string | null;
    }[]
  >();
  for (const a of assignmentsRaw ?? []) {
    const sid = (a as { shift_id: string }).shift_id;
    if (!sid) continue;
    if (!assignmentsByShift.has(sid)) assignmentsByShift.set(sid, []);
    assignmentsByShift.get(sid)!.push({
      id: (a as { id: string }).id,
      status: (a as { status: string }).status ?? "zugewiesen",
      user_id: (a as { user_id: string }).user_id ?? "",
      replacement_user_id: (a as { replacement_user_id?: string }).replacement_user_id ?? null,
      checked_in_at: (a as { checked_in_at?: string | null }).checked_in_at ?? null,
      check_in_method: (a as { check_in_method?: string | null }).check_in_method ?? null,
      attendance_status: (a as { attendance_status?: string | null }).attendance_status ?? null
    });
  }
  const shifts: ShiftForPdf[] = (shiftsRaw ?? []).map((s: Record<string, unknown>) => ({
    id: s.id as string,
    event_name: (s.event_name as string) ?? "",
    date: (s.date as string) ?? "",
    start_time: (s.start_time as string) ?? "",
    end_time: (s.end_time as string) ?? "",
    location: (s.location as string | null) ?? null,
    has_aufbau: !!(s.has_aufbau as boolean),
    has_abbau: !!(s.has_abbau as boolean),
    required_slots: s.required_slots as number | undefined,
    auto_assign: s.auto_assign as boolean | null | undefined,
    claimable: s.claimable as boolean | null | undefined,
    assignment_kind: s.assignment_kind as string | undefined,
    attendance_mode: s.attendance_mode as string | undefined,
    event_id: s.event_id as string | null | undefined,
    qr_token: s.qr_token as string | null | undefined,
    qr_valid_from: s.qr_valid_from as string | null | undefined,
    qr_valid_until: s.qr_valid_until as string | null | undefined,
    shift_assignments: assignmentsByShift.get((s.id as string) ?? "") ?? []
  }));

  const loadMap = new Map(
    (counters ?? []).map((c) => [
      c.user_id as string,
      { load: Number(c.load_index) ?? 0, malus: Number(c.responsibility_malus) ?? 0 }
    ])
  );
  const membersSortedByLoad = (profiles ?? [])
    .map((p) => {
      const c = loadMap.get(p.id) ?? { load: 0, malus: 0 };
      return {
        id: p.id,
        full_name: p.full_name,
        load_index: c.load,
        responsibility_malus: c.malus
      };
    })
    .sort((a, b) => a.load_index - b.load_index);

  const profileNames = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name])
  );
  const profileRoles = new Map(
    (profiles ?? []).map((p: { id: string; role?: string | null }) => [p.id, p.role ?? null])
  );

  const filteredShifts = filterShiftsByTime(shifts, timeFilter, todayStr);

  const consoleStats = computeShiftConsoleStats(shifts, profileNames, todayStr, 30);
  const horizonEnd = addCalendarDays(todayStr, 30);
  const shifts30 = shifts.filter((s) => {
    const d = String(s.date ?? "").slice(0, 10);
    return d >= todayStr && d <= horizonEnd;
  });
  let kpiCap = 0;
  let kpiFilled = 0;
  for (const s of shifts30) {
    kpiCap += Math.max(1, Number(s.required_slots ?? 1) || 1);
    kpiFilled += s.shift_assignments?.length ?? 0;
  }
  const kpiFree = Math.max(0, kpiCap - kpiFilled);

  const eventQuery = (eventOverride?: string) => {
    const p = new URLSearchParams();
    if (effectiveOrgSlug) p.set("org", effectiveOrgSlug);
    if (eventOverride) p.set("event", eventOverride);
    const tf = (searchParams as Record<string, string | undefined>)?.time;
    if (tf && tf !== "all") p.set("time", tf);
    if (activeTab !== "admin") p.set("tab", activeTab);
    const qs = p.toString();
    return qs ? `/admin/shifts?${qs}` : "/admin/shifts";
  };

  return (
    <div className="space-y-4">
      {effectiveOrgSlug && (
        <AdminBreadcrumb orgSlug={effectiveOrgSlug} currentLabel={t("dashboard.shifts", locale)} />
      )}
      {shiftsCreatedSuccess && (
        <p className="rounded-lg border border-[var(--color-success)]/30 bg-[var(--bg-success-subtle)] px-3 py-2 text-sm text-[var(--color-success-text)]">
          {t("shifts.created_success", locale)}
        </p>
      )}
      <ShiftsConsoleShell>
        <Suspense
          fallback={
            <div className="tab-shell mb-5 h-[52px] animate-pulse rounded-[var(--sp-radius-lg)] bg-bg-secondary dark:bg-white/[0.06]" />
          }
        >
          <ShiftsConsoleTabs active={activeTab} />
        </Suspense>
        <div className="sp-tab-spacer" aria-hidden />

        {activeTab === "admin" && (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <ShiftTabFilter />
              {orgId ? <ShiftTrashDropdown orgId={orgId} /> : null}
            </div>
            {events.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-text-secondary">{t("shifts.event_optional", locale)}:</span>
                <Link href={eventQuery()} className="ui-pill" aria-current={!eventIdFilter ? "page" : undefined}>
                  {t("shifts.event_none", locale)}
                </Link>
                {events.map((ev) => (
                  <Link
                    key={ev.id}
                    href={eventQuery(ev.id)}
                    className="ui-pill"
                    aria-current={eventIdFilter === ev.id ? "page" : undefined}
                  >
                    {ev.name}
                  </Link>
                ))}
              </div>
            )}
            <div className="g4 mb-4">
              <div className="stat">
                <div className="sl">{t("shifts.v2_kpi_shifts", locale)}</div>
                <div className="sv">{shifts30.length}</div>
                <div className="ss">{t("shifts.v2_kpi_shifts_sub", locale)}</div>
              </div>
              <div className="stat">
                <div className="sl">{t("shifts.v2_kpi_slots", locale)}</div>
                <div className="sv" style={{ color: "var(--sp-success)" }}>
                  {kpiFilled}/{kpiCap || 0}
                </div>
                <div className="ss">
                  {kpiCap > 0 ? t("shifts.v2_kpi_utilization", locale).replace("{pct}", String(Math.round((kpiFilled / kpiCap) * 100))) : "—"}
                </div>
              </div>
              <div className="stat">
                <div className="sl">{t("shifts.v2_kpi_open", locale)}</div>
                <div className="sv" style={{ color: "var(--sp-warn)" }}>
                  {kpiFree}
                </div>
                <div className="ss">{t("shifts.v2_kpi_open_sub", locale)}</div>
              </div>
              <div className="stat">
                <div className="sl">{t("shifts.console_stats_rate", locale)}</div>
                <div className="sv">
                  {consoleStats.ratePercent != null ? `${consoleStats.ratePercent}%` : "—"}
                </div>
                <div className="ss">{t("shifts.console_stats_last_month", locale)}</div>
              </div>
            </div>
            <section className="card overflow-hidden">
              {shiftsError ? (
                <div className="cbd">
                  <p className="text-xs text-red-300">{shiftsError.message}</p>
                </div>
              ) : !filteredShifts || filteredShifts.length === 0 ? (
                <>
                  <div className="chd flex flex-wrap items-center justify-between gap-2">
                    <span>{t("shifts.v2_manage_shifts_title", locale)}</span>
                    {orgId ? (
                      <NewShiftModal action={createShifts} organizationId={orgId} events={events} engagementEnabled={engagementEnabled} />
                    ) : null}
                  </div>
                  <div className="cbd">
                    <EmptyState messageKey="empty.shifts_first" variant="admin" />
                  </div>
                </>
              ) : (
                <ShiftPlanTableWithEdit
                  orgSlug={effectiveOrgSlug ?? ""}
                  shifts={filteredShifts}
                  profileNames={profileNames}
                  membersSortedByLoad={membersSortedByLoad}
                  assignToShift={assignToShift}
                  deleteShift={deleteShift}
                  updateShift={updateShift}
                  updateEventGroup={updateEventGroup}
                  removeAssignment={removeAssignment}
                  replaceAssignment={replaceAssignment}
                  previewRotationForShift={previewRotationForShift}
                  assignRotationFairOne={assignRotationFairOne}
                  engagementEnabled={engagementEnabled}
                  headerActions={
                    <>
                      <NewShiftModal action={createShifts} organizationId={orgId ?? undefined} events={events} engagementEnabled={engagementEnabled} />
                      {orgId && engagementEnabled ? (
                        <ShiftsAutoAssignConfirmForm action={runAutoAssignForExistingShifts} className="contents">
                          <input type="hidden" name="organization_id" value={orgId} />
                          <input type="hidden" name="org_slug" value={effectiveOrgSlug ?? ""} />
                          <SubmitButtonWithSpinner className="btn btnp" loadingLabel="…">
                            {t("shifts.run_auto_assignment", locale)}
                          </SubmitButtonWithSpinner>
                        </ShiftsAutoAssignConfirmForm>
                      ) : null}
                      {orgId && engagementEnabled ? (
                        <ShiftsAutoAssignConfirmForm
                          action={fillSelfSignupGaps}
                          confirmKey="shifts.confirm_fill_self_signup"
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input type="hidden" name="organization_id" value={orgId} />
                          <input type="hidden" name="org_slug" value={effectiveOrgSlug ?? ""} />
                          <select
                            name="mode"
                            defaultValue="auto"
                            className="sh-fill-mode-select"
                            aria-label={t("shifts.fill_self_signup_mode_label", locale)}
                            title={t("shifts.fill_self_signup_mode_tooltip", locale)}
                          >
                            <option value="auto">{t("shifts.fill_self_signup_mode_auto", locale)}</option>
                            <option value="rotation">{t("shifts.fill_self_signup_mode_rotation", locale)}</option>
                          </select>
                          <SubmitButtonWithSpinner
                            className="btn btnp"
                            loadingLabel="…"
                            aria-label={t("shifts.fill_self_signup_run_aria", locale)}
                          >
                            {t("shifts.fill_self_signup_run", locale)}
                          </SubmitButtonWithSpinner>
                        </ShiftsAutoAssignConfirmForm>
                      ) : null}
                      {orgId && shifts && shifts.length > 0 ? (
                        <ShiftAttendancePdfExport
                          organizationId={orgId}
                          shifts={shifts}
                          profileNames={Object.fromEntries(profileNames)}
                          profileRoles={Object.fromEntries(profileRoles)}
                          organizationName={organizationName ?? undefined}
                          organizationSlug={effectiveOrgSlug ?? undefined}
                          buttonClassName="btn"
                        />
                      ) : null}
                    </>
                  }
                />
              )}
            </section>
          </>
        )}

        {activeTab === "cal" && (
          <div className="sc-card p-4">
            <div className="mb-4">
              <ShiftTabFilter />
            </div>
            {shiftsError ? (
              <p className="text-xs text-red-300">{shiftsError.message}</p>
            ) : !filteredShifts || filteredShifts.length === 0 ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {orgId ? (
                    <NewShiftModal action={createShifts} organizationId={orgId} events={events} engagementEnabled={engagementEnabled} />
                  ) : null}
                </div>
                <EmptyState messageKey="empty.shifts_first" variant="admin" />
              </div>
            ) : (
              <ShiftsCalendarPanel
                shifts={filteredShifts}
                todayStr={todayStr}
                profileNames={Object.fromEntries(profileNames)}
              />
            )}
          </div>
        )}

        {activeTab === "member" && <MemberConsoleShiftsLoader orgSlug={effectiveOrgSlug} />}

        {activeTab === "attend" && (
          <>
            <div className="mb-4">
              <ShiftTabFilter />
            </div>
            <Suspense fallback={<p className="text-sm opacity-80">{t("common.loading", locale)}</p>}>
              <ShiftsAttendanceConsole
                orgSlug={effectiveOrgSlug ?? ""}
                organizationId={orgId ?? undefined}
                organizationName={organizationName ?? undefined}
                shifts={filteredShifts ?? []}
                profileNames={Object.fromEntries(profileNames)}
                profileRoles={Object.fromEntries(profileRoles)}
                markAssignmentAttended={markAssignmentAttended}
                markAssignmentNotAttended={markAssignmentNotAttended}
              />
            </Suspense>
          </>
        )}

        {activeTab === "qr" && (
          <div className="sc-card p-5">
            <ShiftsQrFlowTimeline />
          </div>
        )}

        {activeTab === "stats" && (
          <ShiftsStatsPanel
            locale={locale}
            orgSlug={effectiveOrgSlug}
            ratePercent={consoleStats.ratePercent}
            completedShiftsCount={consoleStats.completedShiftsCount}
            unexcusedMissedCount={consoleStats.unexcusedMissedCount}
            memberRows={consoleStats.memberRows}
          />
        )}

      </ShiftsConsoleShell>
      <RealtimeRefreshBridge organizationId={orgId} table="shift_assignments" />
    </div>
  );
}

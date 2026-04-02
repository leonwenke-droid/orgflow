import { cookies } from "next/headers";
import { getRequestLocale } from "../../../lib/localeServer";
import Link from "next/link";
import { revalidatePath, unstable_noStore } from "next/cache";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { getCurrentUserOrganization } from "../../../lib/getOrganization";
import AdminBreadcrumb from "../../../components/AdminBreadcrumb";
import { removePastShifts } from "../../../lib/cleanupShifts";
import CreateShiftsForm from "../../../components/CreateShiftsForm";
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
import ShiftTabFilter, { filterShiftsByTime, type ShiftTimeFilter } from "../../../components/shifts/ShiftTabFilter";

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
    const eventId = formData.get("event_id")?.toString().trim() || null;
    const assignmentMode = formData.get("assignment_mode")?.toString() || "claim";
    const autoAssign = assignmentMode === "auto" || formData.get("auto_assign") === "on";
    const claimable = assignmentMode !== "auto";

    if (!date) {
      return { error: "Date required.", errorKey: "shifts.date_required" };
    }
    if (!eventName) {
      return { error: "Title required.", errorKey: "shifts.title_required" };
    }

    if (!organizationId) return { errorKey: "common.unauthorized" };
    const actor = await requireOrgAdminAction(organizationId);
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

    const baseRow = (overrides: Partial<{ event_name: string; date: string; start_time: string; end_time: string; location: string | null; notes: string | null; created_by: string | null; required_slots: number; event_id: string | null }>) =>
      ({ event_name: "", date, start_time: "", end_time: "", location, notes, created_by: createdBy, required_slots: requiredSlots, auto_assign: autoAssign, claimable, ...(eventId ? { event_id: eventId } : {}), ...overrides, ...(organizationId ? { organization_id: organizationId } : {}) });

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

        rows.push({
          event_name: eventName,
          date,
          start_time: toHHMM(effectiveStart),
          end_time: toHHMM(effectiveEnd),
          location,
          notes,
          created_by: createdBy,
          required_slots: requiredSlots,
          has_aufbau: hasAufbau,
          has_abbau: hasAbbau,
          auto_assign: autoAssign,
          claimable,
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

  if (!eventName || !date || !startTime || !endTime) return;
  const organizationId = await resolveShiftOrganizationId(shiftId);
  if (!organizationId) return;
  const actor = await requireOrgAdminAction(organizationId);
  if (!actor) return;

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("shifts")
    .update({
      event_name: eventName,
      date,
      start_time: startTime,
      end_time: endTime,
      location,
      notes
    })
    .eq("id", shiftId);

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
  const { error } = await service
    .from("shift_assignments")
    .update({ status: "erledigt" })
    .eq("id", assignmentId);
  if (!error) {
    await writeAuditLog({
      organizationId,
      actorProfileId: actor.actorProfileId,
      action: "shift.assignment_status_updated",
      targetTable: "shift_assignments",
      targetId: assignmentId,
      metadata: { status: "erledigt" }
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
      replacement_user_id: replacementUserId || null
    })
    .eq("id", assignmentId);
  if (updateErr) return;

  const originalUserId = assignment.user_id as string;
  if (replacementUserId) {
    const points = await getShiftDonePoints(service, assignment.shift_id as string);
    await service.from("engagement_events").insert({ user_id: replacementUserId, event_type: "shift_done", points, source_id: assignmentId });
  } else {
    await service.from("engagement_events").insert({
      user_id: originalUserId,
      event_type: "shift_missed",
      points: SHIFT_MISSED_PENALTY,
      source_id: assignmentId
    });
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
  const { data: assignment } = await service
    .from("shift_assignments")
    .select("user_id, shift_id")
    .eq("id", assignmentId)
    .single();
  if (!assignment?.user_id) return;

  await service.from("engagement_events").delete().eq("source_id", assignmentId);

  const { error: updateErr } = await service
    .from("shift_assignments")
    .update({
      status,
      replacement_user_id: status === "abgesagt" ? replacementUserId : null
    })
    .eq("id", assignmentId);
  if (updateErr) return;

  const originalUserId = assignment.user_id as string;
  if (status === "abgesagt") {
    if (replacementUserId) {
      const points = await getShiftDonePoints(service, assignment.shift_id as string);
      await service.from("engagement_events").insert({ user_id: replacementUserId, event_type: "shift_done", points, source_id: assignmentId });
    } else {
      await service.from("engagement_events").insert({ user_id: originalUserId, event_type: "shift_missed", points: SHIFT_MISSED_PENALTY, source_id: assignmentId });
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

/**
 * Löscht alle Schichten einer Veranstaltung (date + event_name exakt oder mit Suffix wie " – 1. Pause").
 * Damit ist z. B. Pausenverkauf komplett löschbar (beide Pausen auf einmal).
 */
async function deleteEventShifts(formData: FormData) {
  "use server";
  const baseEventName = formData.get("eventName")?.toString();
  const date = formData.get("eventDate")?.toString();
  if (!baseEventName || !date) return;
  const service = createSupabaseServiceRoleClient();
  const { data: allOnDate } = await service
    .from("shifts")
    .select("id, event_name")
    .eq("date", date);
  const toDelete = (allOnDate ?? []).filter(
    (s: { id: string; event_name: string }) =>
      s.event_name === baseEventName || s.event_name.startsWith(baseEventName + " – ")
  );
  const ids = toDelete.map((s: { id: string }) => s.id);
  if (ids.length === 0) return;
  const orgForCheck = await resolveShiftOrganizationId(ids[0]);
  if (!orgForCheck) return;
  const actor = await requireOrgAdminAction(orgForCheck);
  if (!actor) return;
  await service.from("shift_assignments").delete().in("shift_id", ids);
  await service
    .from("shifts")
    .update({ deleted_at: new Date().toISOString(), deleted_by: actor.actorProfileId })
    .in("id", ids);
  await writeAuditLog({
    organizationId: orgForCheck,
    actorProfileId: actor.actorProfileId,
    action: "shift.soft_deleted_batch",
    targetTable: "shifts",
    metadata: { count: ids.length, baseEventName }
  });
  revalidatePath("/admin/shifts");
  revalidatePath("/dashboard");
}

async function restoreShift(formData: FormData) {
  "use server";
  const shiftId = String(formData.get("shiftId") ?? "").trim();
  if (!shiftId) return;
  const organizationId = await resolveShiftOrganizationId(shiftId);
  if (!organizationId) return;
  const actor = await requireOrgAdminAction(organizationId);
  if (!actor) return;
  const service = createSupabaseServiceRoleClient();
  await service.from("shifts").update({ deleted_at: null, deleted_by: null }).eq("id", shiftId);
  await writeAuditLog({
    organizationId,
    actorProfileId: actor.actorProfileId,
    action: "shift.restored",
    targetTable: "shifts",
    targetId: shiftId
  });
  revalidatePath("/admin/shifts");
  revalidatePath("/dashboard");
}

type ShiftsPageProps = {
  searchParams?: Promise<{ org?: string; event?: string; success?: string }> | { org?: string; event?: string; success?: string };
};

export default async function ShiftsPage(props: ShiftsPageProps) {
  unstable_noStore();
  const locale = await getRequestLocale();
  const raw = props.searchParams;
  const searchParams = raw && typeof (raw as Promise<unknown>).then === "function"
    ? await (raw as Promise<{ org?: string; event?: string; success?: string }>)
    : (raw ?? {}) as { org?: string; event?: string; success?: string };
  const orgSlug = searchParams?.org?.trim() || null;
  const eventIdFilter = searchParams?.event?.trim() || null;
  const shiftsCreatedSuccess = searchParams?.success === "1";
  const timeFilter = ((searchParams as Record<string, string | undefined>)?.time ?? "all") as ShiftTimeFilter;

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

  if (!profile || !["admin", "lead", "super_admin", "owner"].includes(profile.role)) {
    return (
      <p className="text-sm text-red-300 dark:text-red-200">
        {t("tasks.access_admin_only", locale)}
      </p>
    );
  }

  let orgId: string | null = null;
  if (orgSlug) {
    try {
      const { getCurrentOrganization, isOrgAdmin, getOrgIdForData } = await import("../../../lib/getOrganization");
      const org = await getCurrentOrganization(orgSlug);
      const orgIdForData = getOrgIdForData(orgSlug, org.id);
      if (await isOrgAdmin(orgIdForData)) orgId = orgIdForData;
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

  await removePastShifts(service);

  const todayStr = getTodayDateString();

  const SHIFT_SELECT = "id, event_name, date, start_time, end_time, location, notes, has_aufbau, has_abbau";

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

  let deletedShiftsQuery = service
    .from("shifts")
    .select("id, event_name, date, start_time, deleted_at")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .limit(50);
  if (orgId) {
    deletedShiftsQuery = deletedShiftsQuery.eq("organization_id", orgId);
  }
  const deletedShiftsRes = await deletedShiftsQuery;
  const deletedShifts =
    deletedShiftsRes.error && isMissingSoftDeleteColumnError(deletedShiftsRes.error.message)
      ? []
      : (deletedShiftsRes.data ?? []);

  const profilesQuery = service.from("profiles").select("id, full_name").order("full_name");
  const eventsQuery = orgId
    ? service.from("events").select("id, name").eq("organization_id", orgId).order("name")
    : Promise.resolve({ data: [] as { id: string; name: string }[] });
  if (orgId) {
    profilesQuery.eq("organization_id", orgId);
  }

  const [{ data: assignmentsRaw }, { data: profiles }, { data: counters }, { data: eventsList }] = await Promise.all([
    service.from("shift_assignments").select("id, shift_id, status, user_id, replacement_user_id"),
    profilesQuery,
    service.from("user_counters").select("user_id, load_index, responsibility_malus"),
    eventsQuery
  ]);
  const events = (eventsList ?? []).map((e: { id: string; name: string }) => ({ id: e.id, name: e.name }));

  const assignmentsByShift = new Map<
    string,
    { id: string; status: string; user_id: string; replacement_user_id: string | null }[]
  >();
  for (const a of assignmentsRaw ?? []) {
    const sid = (a as { shift_id: string }).shift_id;
    if (!sid) continue;
    if (!assignmentsByShift.has(sid)) assignmentsByShift.set(sid, []);
    assignmentsByShift.get(sid)!.push({
      id: (a as { id: string }).id,
      status: (a as { status: string }).status ?? "zugewiesen",
      user_id: (a as { user_id: string }).user_id ?? "",
      replacement_user_id: (a as { replacement_user_id?: string }).replacement_user_id ?? null
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

  const filteredShifts = filterShiftsByTime(shifts, timeFilter, todayStr);

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
      <div className="flex flex-wrap items-center gap-3">
        <ShiftTabFilter />
      </div>
      {events.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-text-secondary">{t("shifts.event_optional", locale)}:</span>
          <Link
            href={effectiveOrgSlug ? `/admin/shifts?org=${encodeURIComponent(effectiveOrgSlug)}` : "/admin/shifts"}
            className="ui-pill"
            aria-current={!eventIdFilter ? "page" : undefined}
          >
            {t("shifts.event_none", locale)}
          </Link>
          {events.map((ev) => (
            <Link
              key={ev.id}
              href={effectiveOrgSlug ? `/admin/shifts?org=${encodeURIComponent(effectiveOrgSlug)}&event=${encodeURIComponent(ev.id)}` : `/admin/shifts?event=${encodeURIComponent(ev.id)}`}
              className="ui-pill"
              aria-current={eventIdFilter === ev.id ? "page" : undefined}
            >
              {ev.name}
            </Link>
          ))}
        </div>
      )}
      <h2 className="text-sm font-semibold text-text-secondary">
        {t("shifts.auto_assignment_title", locale)}
      </h2>
      <section className="card space-y-2 text-xs sm:space-y-3">
        <h3 className="text-xs font-semibold text-text-secondary">{t("admin.new_shifts", locale)}</h3>
        <p className="hidden text-[11px] text-text-muted sm:block">
          {t("shifts.help_text", locale)}
        </p>
        <CreateShiftsForm action={createShifts} organizationId={orgId ?? undefined} events={events} />
      </section>
      <section className="overflow-hidden rounded-[var(--radius-modal)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] shadow-sm dark:border-white/10 dark:bg-[#161614]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3 dark:border-white/10 dark:bg-bg-primary/5">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{t("admin.shift_plan", locale)}</h3>
            <p className="mt-0.5 text-[11px] text-text-muted">{t("admin.shift_plan_hint", locale)}</p>
          </div>
          {orgId && (
            <form action={runAutoAssignForExistingShifts} className="flex items-center gap-2">
              <input type="hidden" name="organization_id" value={orgId} />
              <input type="hidden" name="org_slug" value={effectiveOrgSlug ?? ""} />
              <SubmitButtonWithSpinner
                className="btn-primary px-3 py-1.5 text-xs"
                loadingLabel="…"
              >
                {t("shifts.run_auto_assignment", locale)}
              </SubmitButtonWithSpinner>
            </form>
          )}
          {shifts && shifts.length > 0 && (
            <ShiftAttendancePdfExport
              shifts={shifts}
              profileNames={Object.fromEntries(profileNames)}
            />
          )}
        </div>
        <div className="p-4">
        {shiftsError ? (
          <p className="text-xs text-red-300">{shiftsError.message}</p>
        ) : (!filteredShifts || filteredShifts.length === 0) ? (
          <EmptyState messageKey="empty.shifts" actionHref={effectiveOrgSlug ? `/${effectiveOrgSlug}/admin/shifts` : "/admin/shifts"} actionLabelKey="cta.create_shift" />
        ) : (
          <ShiftPlanTableWithEdit
            orgSlug={effectiveOrgSlug ?? undefined}
            shifts={filteredShifts}
            todayStr={todayStr}
            profileNames={profileNames}
            membersSortedByLoad={membersSortedByLoad}
            assignToShift={assignToShift}
            deleteShift={deleteShift}
            deleteEventShifts={deleteEventShifts}
            updateShift={updateShift}
            updateEventGroup={updateEventGroup}
            removeAssignment={removeAssignment}
            replaceAssignment={replaceAssignment}
            markAssignmentAttended={markAssignmentAttended}
            markAssignmentNotAttended={markAssignmentNotAttended}
            updateAssignmentStatus={updateAssignmentStatus}
          />
        )}
        </div>
      </section>
      {(deletedShifts?.length ?? 0) > 0 && (
        <section className="card">
          <h3 className="mb-2 text-sm font-semibold text-text-secondary">{t("shifts.trash_title", locale)}</h3>
          <div className="space-y-2">
            {(deletedShifts ?? []).map((shift: { id: string; event_name?: string | null; date?: string | null; start_time?: string | null; deleted_at?: string | null }) => (
              <form key={shift.id} action={restoreShift} className="flex items-center justify-between gap-2 rounded-[var(--radius-input)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-xs dark:border-white/10 dark:bg-bg-primary/5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{shift.event_name || "Untitled shift"}</p>
                  <p className="text-text-muted">{shift.date || "—"} {shift.start_time || ""}</p>
                </div>
                <input type="hidden" name="shiftId" value={shift.id} />
                <SubmitButtonWithSpinner className="btn-secondary px-2 py-1 text-xs" loadingLabel="…">
                  {t("common.restore", locale)}
                </SubmitButtonWithSpinner>
              </form>
            ))}
          </div>
        </section>
      )}
      <RealtimeRefreshBridge organizationId={orgId} table="shift_assignments" />
    </div>
  );
}

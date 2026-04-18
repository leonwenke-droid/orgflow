import { NextResponse } from "next/server";
import { addCalendarDaysYmd, berlinLocalDateTimeToUtcMs, formatDateYmdInBerlin } from "../../../../lib/berlinCalendarRange";
import { isInShiftReminderWindow } from "../../../../lib/cronReminderWindow";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { sendShiftReminder } from "../../../../lib/n8n";

/**
 * Cron: Erinnerung vor Schichtbeginn (Europe/Berlin: Datum + Startzeit).
 * Fenster: 12–48h vor Start (täglicher Cron, Vercel Hobby-kompatibel); Dedupe via shift_reminder_logs.
 * Authorization: Bearer <CRON_SECRET>
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured." }, { status: 500 });
  }
  const incoming = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : (authHeader ?? "").trim();
  if (incoming !== secret.trim()) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const now = new Date();
  const nowMs = now.getTime();
  const berlinToday = formatDateYmdInBerlin(now);
  const minDate = addCalendarDaysYmd(berlinToday, -1);
  const maxDate = addCalendarDaysYmd(berlinToday, 4);
  if (!minDate || !maxDate) {
    return NextResponse.json({ error: "Date range error." }, { status: 500 });
  }

  const { data: shifts } = await supabase
    .from("shifts")
    .select("id, date, start_time, event_name, organization_id, organizations!inner(name)")
    .gte("date", minDate)
    .lte("date", maxDate);

  if (!shifts?.length) {
    return NextResponse.json({ ok: true, sent: 0, message: "No upcoming shifts" });
  }

  const shiftIds = shifts.map((s) => s.id);
  const { data: assignments } = await supabase
    .from("shift_assignments")
    .select("id, shift_id, user_id")
    .in("shift_id", shiftIds);

  const reminders: {
    assignmentId: string;
    userId: string;
    shiftId: string;
    eventName: string;
    date: string;
    startTime: string;
    orgName: string;
  }[] = [];
  for (const a of assignments ?? []) {
    const shift = shifts.find((s) => s.id === (a as { shift_id: string }).shift_id);
    if (!shift) continue;
    const dateStr = String((shift as { date: string }).date ?? "").slice(0, 10);
    const startTime = String((shift as { start_time: string }).start_time ?? "");
    const startMs = berlinLocalDateTimeToUtcMs(dateStr, startTime);
    if (startMs == null || !isInShiftReminderWindow(nowMs, startMs)) continue;

    reminders.push({
      assignmentId: (a as { id: string }).id,
      userId: (a as { user_id: string }).user_id,
      shiftId: shift.id,
      eventName: (shift as { event_name?: string }).event_name ?? "",
      date: dateStr,
      startTime,
      orgName: (shift as { organizations?: { name?: string } }).organizations?.name ?? ""
    });
  }

  // Filter out already-sent reminders
  const assignmentIds = reminders.map((r) => r.assignmentId);
  const { data: alreadySentRows } = assignmentIds.length > 0
    ? await supabase
        .from("shift_reminder_logs")
        .select("assignment_id")
        .in("assignment_id", assignmentIds)
    : { data: [] as any[] };
  const alreadySent = new Set((alreadySentRows ?? []).map((r: any) => String(r.assignment_id)));
  const toSend = reminders.filter((r) => !alreadySent.has(r.assignmentId));

  const userIds = [...new Set(toSend.map((r) => r.userId))];
  const { data: profiles } = userIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds)
    : { data: [] as any[] };
  const emailByProfileId = new Map((profiles ?? []).map((p: any) => [String(p.id), String(p.email ?? "")]));
  const nameByProfileId = new Map((profiles ?? []).map((p: any) => [String(p.id), String(p.full_name ?? "")]));

  let sent = 0;
  for (const r of toSend) {
    const to = emailByProfileId.get(r.userId) ?? "";
    if (!to || !to.includes("@")) continue;
    try {
      await sendShiftReminder({
        email: to,
        fullName: nameByProfileId.get(r.userId) ?? undefined,
        eventName: r.eventName,
        date: r.date,
        startTime: r.startTime || undefined,
        orgName: r.orgName ?? "OrgFlow"
      });
      sent += 1;
      try {
        await supabase.from("shift_reminder_logs").insert({ assignment_id: r.assignmentId });
      } catch {
        // ignore
      }
    } catch (err) {
      console.error("[shift-reminders] n8n failed:", err);
    }
  }

  return NextResponse.json({ ok: true, sent, reminders: reminders.length });
}

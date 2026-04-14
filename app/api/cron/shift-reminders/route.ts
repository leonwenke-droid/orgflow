import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { sendEmail } from "../../../../lib/email";

/**
 * Cron endpoint: send reminders for shifts starting in the next 24h.
 * Call with header: Authorization: Bearer <CRON_SECRET> (set CRON_SECRET in env).
 * To actually send emails, integrate Resend (or similar) and replace the TODO below.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured." }, { status: 500 });
  }
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: shifts } = await supabase
    .from("shifts")
    .select("id, date, start_time, event_name, organization_id")
    .gte("date", now.toISOString().slice(0, 10))
    .lte("date", tomorrow.toISOString().slice(0, 10));

  if (!shifts?.length) {
    return NextResponse.json({ ok: true, sent: 0, message: "No upcoming shifts" });
  }

  const shiftIds = shifts.map((s) => s.id);
  const { data: assignments } = await supabase
    .from("shift_assignments")
    .select("id, shift_id, user_id")
    .in("shift_id", shiftIds);

  const reminders: { assignmentId: string; userId: string; shiftId: string; eventName: string; date: string; startTime: string }[] = [];
  for (const a of assignments ?? []) {
    const shift = shifts.find((s) => s.id === (a as { shift_id: string }).shift_id);
    if (shift) {
      reminders.push({
        assignmentId: (a as { id: string }).id,
        userId: (a as { user_id: string }).user_id,
        shiftId: shift.id,
        eventName: (shift as { event_name?: string }).event_name ?? "",
        date: (shift as { date: string }).date,
        startTime: (shift as { start_time: string }).start_time ?? "",
      });
    }
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

  let sent = 0;
  for (const r of toSend) {
    const to = emailByProfileId.get(r.userId) ?? "";
    if (!to || !to.includes("@")) continue;
    const subject = `Shift reminder: ${r.eventName || "Upcoming shift"}`;
    const text = [
      `Hi,`,
      ``,
      `this is a reminder for your shift: ${r.eventName || "Shift"}`,
      `Date: ${r.date}`,
      `Start: ${r.startTime || "–"}`,
      ``,
      `OrgFlow`
    ].join("\n");

    const result = await sendEmail({ to, subject, text });
    if (result.ok) {
      sent += 1;
      try {
        await supabase.from("shift_reminder_logs").insert({ assignment_id: r.assignmentId });
      } catch {
        // ignore
      }
    }
  }

  return NextResponse.json({ ok: true, sent, reminders: reminders.length });
}

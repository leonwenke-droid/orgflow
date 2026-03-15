import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";

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
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nowStr = now.toISOString().slice(0, 19).replace("T", " ");
  const tomorrowStr = tomorrow.toISOString().slice(0, 19).replace("T", " ");

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

  const reminders: { userId: string; shiftId: string; eventName: string; date: string; startTime: string }[] = [];
  for (const a of assignments ?? []) {
    const shift = shifts.find((s) => s.id === (a as { shift_id: string }).shift_id);
    if (shift) {
      reminders.push({
        userId: (a as { user_id: string }).user_id,
        shiftId: shift.id,
        eventName: (shift as { event_name?: string }).event_name ?? "",
        date: (shift as { date: string }).date,
        startTime: (shift as { start_time: string }).start_time ?? "",
      });
    }
  }

  // TODO: For each reminder, load profile email and send via Resend (or similar).
  // const sent = await sendReminderEmails(reminders);
  const sent = 0;

  return NextResponse.json({ ok: true, sent, reminders: reminders.length });
}

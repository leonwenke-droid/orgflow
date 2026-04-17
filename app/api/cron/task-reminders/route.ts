import { NextResponse } from "next/server";
import { reminderTargetWindowIso } from "../../../../lib/cronReminderWindow";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { sendTaskReminder } from "../../../../lib/n8n";
import { getPublicOriginSync } from "../../../../lib/publicBaseUrl";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured." }, { status: 500 });
  if (authHeader !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const supabase = createSupabaseServiceRoleClient();
  const nowMs = Date.now();
  const { lowIso, highIso } = reminderTargetWindowIso(nowMs);

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, description, due_at, owner_id, organization_id")
    .not("owner_id", "is", null)
    .eq("status", "offen")
    .gte("due_at", lowIso)
    .lte("due_at", highIso);

  if (!tasks?.length) return NextResponse.json({ ok: true, sent: 0 });

  const taskIds = tasks.map((t) => t.id as string);
  const { data: alreadySent } = await supabase.from("task_reminder_logs").select("task_id").in("task_id", taskIds);
  const sentSet = new Set((alreadySent ?? []).map((r: { task_id: string }) => String(r.task_id)));
  const toSend = tasks.filter((t) => !sentSet.has(String(t.id)));

  if (!toSend.length) return NextResponse.json({ ok: true, sent: 0 });

  const ownerIds = [...new Set(toSend.map((t) => t.owner_id as string))];
  const orgIds = [...new Set(toSend.map((t) => t.organization_id as string))];

  const [{ data: profiles }, { data: orgs }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name").in("id", ownerIds),
    supabase.from("organizations").select("id, name, slug").in("id", orgIds)
  ]);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  const orgMap = new Map((orgs ?? []).map((o) => [o.id as string, o]));

  const base = getPublicOriginSync();
  let sent = 0;
  for (const task of toSend) {
    const profile = profileMap.get(task.owner_id as string);
    const org = orgMap.get(task.organization_id as string);
    const email = (profile as { email?: string | null } | null)?.email;
    if (!email) continue;

    const orgSlug = String((org as { slug?: string } | null)?.slug ?? "").trim();
    const taskUrl = orgSlug ? `${base}/${orgSlug}/tasks` : undefined;

    try {
      await sendTaskReminder({
        email,
        fullName: (profile as { full_name?: string | null } | null)?.full_name ?? undefined,
        taskTitle: String((task as { title?: string }).title ?? "Aufgabe"),
        dueAt: (task as { due_at?: string | null }).due_at
          ? new Date(String((task as { due_at: string }).due_at)).toLocaleString("de-DE", {
              dateStyle: "medium",
              timeStyle: "short"
            })
          : undefined,
        orgName: String((org as { name?: string } | null)?.name ?? "OrgFlow"),
        orgSlug,
        taskUrl
      });
      sent += 1;
      const { error: logErr } = await supabase.from("task_reminder_logs").insert({ task_id: task.id });
      if (logErr) console.error("[task-reminders] log insert:", logErr.message);
    } catch (err) {
      console.error("[task-reminders] n8n failed:", err);
    }
  }

  return NextResponse.json({ ok: true, sent, total: toSend.length });
}

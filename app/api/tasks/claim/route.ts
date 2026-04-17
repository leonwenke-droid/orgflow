import { NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getCurrentOrganization, getOrgIdForData } from "../../../../lib/getOrganization";
import { writeAuditLog } from "../../../../lib/audit";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { sendTaskAssigned } from "../../../../lib/n8n";
import { getPublicOriginSync } from "../../../../lib/publicBaseUrl";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const orgSlug = String(body.orgSlug ?? "").trim();
    const taskId = String(body.taskId ?? "").trim();
    if (!orgSlug || !taskId) return NextResponse.json({ message: "orgSlug and taskId required." }, { status: 400 });

    const org = await getCurrentOrganization(orgSlug);
    const orgIdForData = getOrgIdForData(orgSlug, org.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("organization_id", orgIdForData)
      .single();
    if (!profile) return NextResponse.json({ message: "You are not a member of this organisation." }, { status: 403 });

    const { error: rpcErr } = await supabase.rpc("claim_task", { task_id: taskId });
    if (rpcErr) {
      const msg = (rpcErr as { message?: string }).message ?? "";
      if (/already_claimed/i.test(msg) || (rpcErr as { code?: string }).code === "23505") {
        return NextResponse.json({ message: "Task already claimed." }, { status: 400 });
      }
      if (/not_claimable/i.test(msg)) {
        return NextResponse.json({ message: "Task is not claimable." }, { status: 400 });
      }
      if (/read_only/i.test(msg)) {
        return NextResponse.json({ message: "Read-only role cannot claim tasks." }, { status: 403 });
      }
      if (/task_not_found/i.test(msg)) {
        return NextResponse.json({ message: "Task not found." }, { status: 404 });
      }
      return NextResponse.json({ message: "Failed to claim task." }, { status: 500 });
    }

    await writeAuditLog({
      organizationId: orgIdForData,
      actorProfileId: (profile as { id: string }).id,
      action: "task_claimed",
      targetTable: "tasks",
      targetId: taskId,
      metadata: {}
    });

    // Treat claiming as an assignment event (member gets ownership) → trigger webhook email.
    try {
      const service = createSupabaseServiceRoleClient();
      const [{ data: taskRow }, { data: prof }, { data: orgRow }] = await Promise.all([
        service.from("tasks").select("title, description, due_at, owner_id").eq("id", taskId).maybeSingle(),
        service.from("profiles").select("email, full_name").eq("id", (profile as { id: string }).id).maybeSingle(),
        service.from("organizations").select("name, slug").eq("id", orgIdForData).maybeSingle()
      ]);
      const em = (prof as { email?: string | null } | null)?.email;
      const orgSlugResolved = String((orgRow as { slug?: string | null } | null)?.slug ?? "").trim();
      if (em && orgSlugResolved) {
        const base = getPublicOriginSync();
        const taskUrl = `${base}/${orgSlugResolved}/tasks`;
        void sendTaskAssigned({
          email: em,
          fullName: (prof as { full_name?: string | null } | null)?.full_name ?? undefined,
          taskTitle: String((taskRow as { title?: string } | null)?.title ?? "Aufgabe"),
          description: (taskRow as { description?: string | null } | null)?.description ?? undefined,
          dueAt: (taskRow as { due_at?: string | null } | null)?.due_at
            ? new Date(String((taskRow as { due_at: string }).due_at)).toLocaleString("de-DE", {
                dateStyle: "medium",
                timeStyle: "short"
              })
            : undefined,
          orgName: String((orgRow as { name?: string | null } | null)?.name ?? "OrgFlow"),
          orgSlug: orgSlugResolved,
          taskUrl
        }).catch(() => {});
      }
    } catch (e) {
      console.error("[tasks/claim] sendTaskAssigned failed", e);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[tasks/claim]", e);
    return NextResponse.json({ message: "An error occurred." }, { status: 500 });
  }
}


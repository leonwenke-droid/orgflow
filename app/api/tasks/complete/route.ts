import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getCurrentOrganization, getOrgIdForData } from "../../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";

export const runtime = "nodejs";

const ALLOWED_STATUS = ["in_arbeit", "erledigt"] as const;

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ message: "Sign in required." }, { status: 401 });
    }

    const formData = await req.formData();
    const orgSlug = formData.get("orgSlug")?.toString()?.trim() ?? "";
    const taskId = formData.get("taskId")?.toString()?.trim() ?? "";
    const status = formData.get("status")?.toString() as
      | (typeof ALLOWED_STATUS)[number]
      | undefined;
    const file = formData.get("file") as File | null;

    if (!orgSlug || !taskId || !status || !ALLOWED_STATUS.includes(status)) {
      return NextResponse.json({ message: "Invalid request." }, { status: 400 });
    }

    const org = await getCurrentOrganization(orgSlug);
    const orgIdForData = getOrgIdForData(orgSlug, org.id);

    let { data: profilePrimary } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("organization_id", orgIdForData)
      .maybeSingle();
    let profile = profilePrimary;
    if (!profile && orgIdForData !== org.id) {
      const { data: p2 } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_user_id", user.id)
        .eq("organization_id", org.id)
        .maybeSingle();
      profile = p2;
    }
    if (!profile) {
      return NextResponse.json(
        { message: "Not a member of this organisation." },
        { status: 403 }
      );
    }

    const effectiveOrgId = profilePrimary ? orgIdForData : org.id;
    const profileId = profile.id as string;

    const service = createSupabaseServiceRoleClient();
    const { data: task, error: taskError } = await service
      .from("tasks")
      .select("id, proof_required, proof_url, owner_id, organization_id")
      .eq("id", taskId)
      .maybeSingle();

    if (taskError || !task) {
      return NextResponse.json({ message: "Task not found." }, { status: 404 });
    }

    if (task.organization_id !== effectiveOrgId) {
      return NextResponse.json({ message: "Task not found." }, { status: 404 });
    }

    if (task.owner_id !== profileId) {
      return NextResponse.json(
        { message: "You can only update tasks assigned to you." },
        { status: 403 }
      );
    }

    let proofUrl = task.proof_url as string | null;

    if (file && typeof file.size === "number" && file.size > 0) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext = file.name.split(".").pop() ?? "dat";
      const path = `task-proofs/${task.id}-${Date.now()}.${ext}`;

      const { data: uploadData, error: uploadError } = await service.storage
        .from("task_proofs")
        .upload(path, buffer, {
          contentType: file.type || "application/octet-stream"
        });

      if (uploadError) {
        console.error(uploadError);
        return NextResponse.json(
          { message: "Proof upload failed." },
          { status: 500 }
        );
      }

      const pathInBucket = uploadData?.path ?? path;
      const {
        data: { publicUrl }
      } = service.storage.from("task_proofs").getPublicUrl(pathInBucket);

      proofUrl = publicUrl;
    }

    if (task.proof_required && status === "erledigt" && !proofUrl) {
      return NextResponse.json(
        {
          message:
            "Proof is required for this task. Upload a file before marking it done."
        },
        { status: 400 }
      );
    }

    const proofUrlToSet = proofUrl ?? task.proof_url ?? null;

    const { error: updateError } = await service
      .from("tasks")
      .update({
        status,
        proof_url: proofUrlToSet
      })
      .eq("id", task.id);

    if (updateError) {
      console.error("tasks update error", updateError);
      return NextResponse.json(
        {
          message: "Failed to update task.",
          detail: updateError.message
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Task updated." });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: "Unexpected error." }, { status: 500 });
  }
}

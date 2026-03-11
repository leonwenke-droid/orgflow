import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";

export const runtime = "nodejs";

const ALLOWED_STATUS = ["offen", "in_arbeit", "erledigt"] as const;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const token = formData.get("token")?.toString();
    const status = formData.get("status")?.toString() as
      | (typeof ALLOWED_STATUS)[number]
      | undefined;
    const comment = formData.get("comment")?.toString() ?? "";
    const file = formData.get("file") as File | null;

    if (!token || !status || !ALLOWED_STATUS.includes(status)) {
      return NextResponse.json(
        { message: "Ungültige Anfrage." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServiceRoleClient();

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, proof_required, proof_url, access_token, owner_id")
      .eq("access_token", token)
      .maybeSingle();

    if (taskError || !task) {
      return NextResponse.json(
        { message: "Aufgabe nicht gefunden." },
        { status: 404 }
      );
    }

    let proofUrl = task.proof_url as string | null;

    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext = file.name.split(".").pop() ?? "dat";
      const path = `task-proofs/${task.id}-${Date.now()}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("task_proofs")
        .upload(path, buffer, {
          contentType: file.type || "application/octet-stream"
        });

      if (uploadError) {
        console.error(uploadError);
        return NextResponse.json(
          { message: "Upload des Belegs fehlgeschlagen." },
          { status: 500 }
        );
      }

      const pathInBucket = uploadData?.path ?? path;
      const {
        data: { publicUrl }
      } = supabase.storage.from("task_proofs").getPublicUrl(pathInBucket);

      proofUrl = publicUrl;
    }

    if (task.proof_required && status === "erledigt" && !proofUrl) {
      return NextResponse.json(
        {
          message:
            "Für diese Aufgabe ist ein Beleg Pflicht. Bitte zuerst Datei hochladen."
        },
        { status: 400 }
      );
    }

    const proofUrlToSet = proofUrl ?? task.proof_url ?? null;

    const { error: updateError } = await supabase
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
          message: "Fehler beim Aktualisieren der Aufgabe.",
          detail: updateError.message
        },
        { status: 500 }
      );
    }

    if (comment.trim() && task.owner_id) {
      await supabase.from("engagement_events").insert({
        user_id: task.owner_id,
        event_type: "task_done",
        points: 0,
        source_id: task.id
      });
    }

    return NextResponse.json({
      message: "Aufgabe aktualisiert."
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: "Unerwarteter Fehler." },
      { status: 500 }
    );
  }
}


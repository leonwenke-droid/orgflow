import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const VALID_STATUSES = ["offen", "in_arbeit", "erledigt", "ueberfaellig"] as const;

const PROOF_REQUIRED_MESSAGE =
  "Für diese Aufgabe ist ein Beleg Pflicht. Bitte zuerst Datei hochladen.";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      status?: unknown;
      proof_url?: unknown;
    };
    const status = String(body.status ?? "").trim();
    const proofUrlFromBody =
      typeof body.proof_url === "string"
        ? body.proof_url.trim() || null
        : null;

    if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      return NextResponse.json(
        { error: `Ungültiger Status: ${status}` },
        { status: 400 }
      );
    }

    if (status === "erledigt") {
      const { data: existing, error: readErr } = await supabase
        .from("tasks")
        .select("proof_required, proof_url")
        .eq("id", params.id)
        .maybeSingle();

      if (readErr || !existing) {
        return NextResponse.json(
          { error: "Aufgabe nicht gefunden." },
          { status: 404 }
        );
      }

      const hasProof =
        !!(proofUrlFromBody ?? (existing.proof_url as string | null));
      if (existing.proof_required && !hasProof) {
        return NextResponse.json(
          {
            error: PROOF_REQUIRED_MESSAGE,
            errorKey: "tasks.proof_required_before_done",
          },
          { status: 400 }
        );
      }
    }

    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === "erledigt") {
      patch.completed_at = new Date().toISOString();
      if (proofUrlFromBody) {
        patch.proof_url = proofUrlFromBody;
      }
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", params.id)
      .select()
      .maybeSingle();

    if (error) {
      console.error("Supabase update error:", error);
      const errCode = (error as { code?: string }).code;
      if (
        errCode === "23514" &&
        String(error.message).includes("tasks_proof_check")
      ) {
        return NextResponse.json(
          {
            error: PROOF_REQUIRED_MESSAGE,
            errorKey: "tasks.proof_required_before_done",
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { errorKey: "tasks.not_authorized", error: "Task not found or not allowed." },
        { status: 403 }
      );
    }

    return NextResponse.json({ task: data });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}


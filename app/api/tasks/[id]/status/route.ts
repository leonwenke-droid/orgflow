import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const VALID_STATUSES = ["offen", "in_arbeit", "erledigt", "ueberfaellig"] as const;

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

    const body = await req.json().catch(() => ({}));
    const status = String(body.status ?? "").trim();

    if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      return NextResponse.json(
        { error: `Ungültiger Status: ${status}` },
        { status: 400 }
      );
    }

    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === "erledigt") {
      patch.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
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


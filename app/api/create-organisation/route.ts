import { NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { message: "Sign in required to create an organisation." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const name = (body.name as string)?.trim();
    const orgType = (body.orgType as string) || "other";
    const modules = Array.isArray(body.modules)
      ? (body.modules as string[]).map((m: string) => String(m).trim()).filter(Boolean)
      : ["tasks", "shifts", "finance", "resources", "engagement"];
    const teams = Array.isArray(body.teams)
      ? (body.teams as string[]).map((t: string) => String(t).trim()).filter(Boolean)
      : [];

    if (!name) {
      return NextResponse.json(
        { message: "Organisation name is required." },
        { status: 400 }
      );
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50) || `org-${Date.now()}`;

    const serviceClient = createSupabaseServiceRoleClient();
    const { data: existing } = await serviceClient
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .single();

    let finalSlug = slug;
    if (existing) {
      finalSlug = `${slug}-${Date.now().toString(36)}`;
    }

    const orgId = randomUUID();
    const features: Record<string, boolean> = {
      tasks: modules.includes("tasks"),
      shifts: modules.includes("shifts"),
      treasury: modules.includes("finance"),
      resources: modules.includes("resources"),
      materials: modules.includes("resources"),
      engagement_tracking: modules.includes("engagement"),
      events: modules.includes("events"),
    };
    const insertPayload = {
      id: orgId,
      name,
      slug: finalSlug,
      subdomain: null,
      school_name: name,
      school_short: null,
      school_city: null,
      year: new Date().getFullYear(),
      org_type: ["school", "club", "sports_club", "volunteer_group", "event_crew", "ngo", "conference", "custom"].includes(orgType) ? orgType : "other",
      is_active: true,
      setup_token: null,
      setup_token_used_at: null,
      settings: {
        currency: "EUR",
        timezone: "Europe/Berlin",
        features,
        engagement_weights: { task_done: 8, shift_done: 10, material_small: 5, material_medium: 10, material_large: 15 },
        contact_email: "",
        contact_phone: "",
      },
    };

    const { data: org, error: orgError } = await serviceClient
      .from("organizations")
      .insert(insertPayload)
      .select()
      .single();

    if (orgError || !org) {
      console.error("Error creating org:", orgError);
      return NextResponse.json(
        { message: orgError?.message || "Failed to create organisation." },
        { status: 500 }
      );
    }

    if (teams.length > 0) {
      const committees = teams.map((t) => ({
        name: t,
        organization_id: org.id,
        is_default: false
      }));
      await serviceClient.from("committees").insert(committees);
    }

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (profile) {
      await serviceClient
        .from("profiles")
        .update({
          organization_id: org.id,
          role: "admin"
        })
        .eq("id", profile.id);
    } else {
      await serviceClient.from("profiles").insert({
        id: randomUUID(),
        auth_user_id: user.id,
        full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
        email: user.email,
        role: "admin",
        organization_id: org.id
      });
    }

    return NextResponse.json({ slug: org.slug, orgId: org.id });
  } catch (e) {
    console.error("create-organisation error:", e);
    return NextResponse.json(
      { message: "An error occurred." },
      { status: 500 }
    );
  }
}

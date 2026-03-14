import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = (body.email as string)?.trim();
    if (!email) {
      return NextResponse.json({ message: "Email is required." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (req.headers.get("origin") ?? "");
    const redirectTo = `${baseUrl.replace(/\/$/, "")}/auth/callback`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      console.error("[forgot-password]", error);
      return NextResponse.json(
        { message: error.message || "Failed to send reset email." },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: "Check your email for the reset link." });
  } catch (e) {
    console.error("[forgot-password]", e);
    return NextResponse.json({ message: "An error occurred." }, { status: 500 });
  }
}

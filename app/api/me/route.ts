import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ emailConfirmed: true }); // no user = no banner
    }
    const emailConfirmed = !!(user as { email_confirmed_at?: string | null }).email_confirmed_at;
    return NextResponse.json({ emailConfirmed });
  } catch {
    return NextResponse.json({ emailConfirmed: true }, { status: 200 });
  }
}

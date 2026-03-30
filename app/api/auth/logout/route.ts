import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

function hardenAuthCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  for (const c of cookieStore.getAll()) {
    if (!c.name.startsWith("sb-")) continue;
    if (!c.name.includes("-auth-token")) continue;
    cookieStore.set({
      name: c.name,
      value: c.value,
      path: "/",
      sameSite: "lax",
      secure: true,
      httpOnly: true,
      maxAge,
    });
  }
}

export async function POST() {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.error("Logout failed", e);
  }

  hardenAuthCookies(cookieStore);
  return NextResponse.json({ success: true });
}


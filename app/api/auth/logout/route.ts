import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

function hardenAuthCookies(cookieStore: Awaited<ReturnType<typeof cookies>>, opts: { secure: boolean }) {
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  for (const c of cookieStore.getAll()) {
    if (!c.name.startsWith("sb-")) continue;
    if (!c.name.includes("-auth-token")) continue;
    cookieStore.set({
      name: c.name,
      value: c.value,
      path: "/",
      sameSite: "lax",
      secure: opts.secure,
      httpOnly: true,
      maxAge,
    });
  }
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.error("Logout failed", e);
  }

  const host = req.headers.get("host") ?? "";
  const isLocalhost =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("[::1]") ||
    host.includes("localhost:");
  const shouldUseSecureCookies = process.env.NODE_ENV === "production" && !isLocalhost;
  hardenAuthCookies(cookieStore, { secure: shouldUseSecureCookies });
  return NextResponse.json({ success: true });
}


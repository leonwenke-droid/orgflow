import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { isSuperAdmin } from "../../../lib/getOrganization";

export const dynamic = "force-dynamic";

export default async function OrgCreatedPage({
  searchParams
}: {
  searchParams: Promise<{ slug?: string; token?: string }> | { slug?: string; token?: string };
}) {
  if (!(await isSuperAdmin())) redirect("/");

  const params = typeof (searchParams as Promise<{ slug?: string; token?: string }>).then === "function"
    ? await (searchParams as Promise<{ slug?: string; token?: string }>)
    : (searchParams as { slug?: string; token?: string });
  const slug = params?.slug?.trim();
  const token = params?.token?.trim();

  if (!slug || !token) {
    redirect("/super-admin");
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const claimUrl = baseUrl ? `${baseUrl.replace(/\/$/, "")}/claim-org?token=${encodeURIComponent(token)}` : `[NEXT_PUBLIC_APP_URL]/claim-org?token=${token}`;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-lg border border-green-500/40 bg-green-500/5 p-6">
          <h1 className="text-xl font-bold text-cyan-100">Organisation erstellt</h1>
          <p className="mt-2 text-sm text-cyan-300">
            Teile diesen Link mit der berechtigten Person. Sie kann damit die Organisation übernehmen und sich als Admin anlegen bzw. einloggen.
          </p>
          <div className="mt-4 rounded bg-black/20 p-3 font-mono text-sm text-cyan-200 break-all">
            {claimUrl}
          </div>
          <p className="mt-2 text-xs text-cyan-400/80">
            The link is single-use. After use, the person can set up the organisation (members, teams, admins).
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/super-admin"
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
          >
            Zurück zum Super-Admin
          </Link>
        </div>
      </div>
    </div>
  );
}

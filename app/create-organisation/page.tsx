import { Suspense } from "react";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import AuthPageShell from "../../components/auth/AuthPageShell";
import AuthLoginRegisterCard from "../../components/auth/AuthLoginRegisterCard";
import { createSupabaseServiceRoleClient } from "../../lib/supabaseServer";
import CreateOrganisationClient from "./CreateOrganisationClient";

export const dynamic = "force-dynamic";

/** Gleicher Ablauf wie mit bestehender Session: Wizard sofort, Anmeldung erst beim finalen API-Call (siehe Client). */
export default async function CreateOrganisationPage() {
  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AuthPageShell>
        <AuthLoginRegisterCard redirectTo="/create-organisation" orgName={null} />
      </AuthPageShell>
    );
  }

  // Optional hint: user already has organisation memberships
  let orgCount: number | null = null;
  try {
    const service = createSupabaseServiceRoleClient();
    const { data: profiles } = await service
      .from("profiles")
      .select("organization_id, status")
      .eq("auth_user_id", user.id)
      .neq("status", "disabled");
    const ids = [...new Set((profiles ?? []).map((p: any) => String(p.organization_id ?? "")).filter(Boolean))];
    orgCount = ids.length;
  } catch {}

  return (
    <>
      {orgCount != null && orgCount > 0 ? (
        <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-6">
          <div className="rounded-xl border border-border-subtle bg-bg-secondary px-4 py-3 text-xs text-text-secondary">
            Du bist bereits in {orgCount} Organisation{orgCount === 1 ? "" : "en"}.
          </div>
        </div>
      ) : null}
      <Suspense
        fallback={
          <div className="min-h-screen bg-bg-secondary py-12 text-center text-sm text-text-secondary">Loading…</div>
        }
      >
        <CreateOrganisationClient />
      </Suspense>
    </>
  );
}

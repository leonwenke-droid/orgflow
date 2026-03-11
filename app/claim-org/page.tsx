import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServiceRoleClient } from "../../lib/supabaseServer";
import ClaimOrgClient from "./ClaimOrgClient";

export default async function ClaimOrgPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }> | { token?: string };
}) {
  const params = typeof (searchParams as Promise<{ token?: string }>).then === "function"
    ? await (searchParams as Promise<{ token?: string }>)
    : (searchParams as { token?: string });
  const token = params?.token?.trim();

  if (!token) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-bold text-cyan-100">Ungültiger Link</h1>
        <p className="mt-2 text-sm text-cyan-300">Es wurde kein gültiger Einrichtungs-Link angegeben.</p>
      </div>
    );
  }

  const service = createSupabaseServiceRoleClient();
  const { data: org, error } = await service
    .from("organizations")
    .select("id, name, slug")
    .eq("setup_token", token)
    .is("setup_token_used_at", null)
    .eq("is_active", true)
    .single();

  if (error || !org) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-bold text-cyan-100">Link ungültig oder bereits verwendet</h1>
        <p className="mt-2 text-sm text-cyan-300">Dieser Einrichtungs-Link ist abgelaufen oder wurde schon genutzt.</p>
      </div>
    );
  }

  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-bold text-cyan-100">Organisation übernehmen</h1>
      <p className="mt-2 text-sm text-cyan-300">
        {org.name}
      </p>
      <p className="mt-2 text-sm text-cyan-300/90">
        Gib deine E-Mail und ein Passwort an (Account anlegen oder einloggen). Danach klicke auf „Als Admin übernehmen“. Anschließend kannst du Komitees anlegen, Personen hochladen, Leads bestimmen und die Einrichtung fortsetzen.
      </p>
      <ClaimOrgClient org={org} token={token} user={user ?? null} />
    </div>
  );
}

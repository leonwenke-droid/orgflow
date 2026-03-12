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
        <h1 className="text-xl font-bold text-blue-100">Invalid link</h1>
        <p className="mt-2 text-sm text-blue-300">No valid setup link was provided.</p>
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
        <h1 className="text-xl font-bold text-blue-100">Link invalid or already used</h1>
        <p className="mt-2 text-sm text-blue-300">This setup link has expired or has already been used.</p>
      </div>
    );
  }

  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-bold text-blue-100">Take over organization</h1>
      <p className="mt-2 text-sm text-blue-300">
        {org.name}
      </p>
      <p className="mt-2 text-sm text-blue-300/90">
        Gib deine E-Mail und ein Passwort an (Account anlegen oder einloggen). Danach klicke auf „Als Admin übernehmen“. Anschließend kannst du Komitees anlegen, Personen hochladen, Leads bestimmen und die Einrichtung fortsetzen.
      </p>
      <ClaimOrgClient org={org} token={token} user={user ?? null} />
    </div>
  );
}

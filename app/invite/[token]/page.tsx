import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { hashInviteToken } from "../../../lib/memberInvites";
import InviteActivationClient from "./InviteActivationClient";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params
}: {
  params: Promise<{ token: string }> | { token: string };
}) {
  const token = typeof (params as Promise<{ token: string }>).then === "function"
    ? (await (params as Promise<{ token: string }>)).token
    : (params as { token: string }).token;

  if (!token) notFound();

  const tokenHash = hashInviteToken(token);
  const service = createSupabaseServiceRoleClient();
  const { data: member } = await service
    .from("profiles")
    .select("id, full_name, email, status, invite_status, invite_expires_at, organization:organizations!profiles_organization_id_fkey(id, name, slug)")
    .eq("invite_token_hash", tokenHash)
    .maybeSingle();

  if (!member) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Invalid invite</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          This invite link is invalid, revoked or expired.
        </p>
      </div>
    );
  }

  const orgRaw = (member as { organization?: unknown }).organization;
  const org =
    Array.isArray(orgRaw)
      ? (orgRaw[0] as { id: string; name: string; slug: string } | undefined)
      : (orgRaw as { id: string; name: string; slug: string } | null | undefined);
  if (!org?.slug) notFound();

  const cookieStore = await cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });
  const { data: { user } } = await supabase.auth.getUser();

  const isExpired = Boolean((member as { invite_expires_at?: string | null }).invite_expires_at && new Date((member as { invite_expires_at?: string | null }).invite_expires_at as string) < new Date());
  const isRevoked = (member as { invite_status?: string }).invite_status === "revoked";
  const isDisabled = (member as { status?: string }).status === "disabled";
  if (isExpired || isRevoked || isDisabled) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Invite expired</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Please ask an administrator for a new invitation.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <InviteActivationClient
        token={token}
        orgSlug={org.slug}
        orgName={org.name}
        memberName={(member as { full_name?: string | null }).full_name ?? ""}
        memberEmail={(member as { email?: string | null }).email ?? ""}
        isAlreadySignedIn={!!user}
      />
    </div>
  );
}

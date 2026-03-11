import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentOrganization } from "../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import JoinOrgClient from "./JoinOrgClient";

export const dynamic = "force-dynamic";

export default async function JoinOrgPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { org: orgSlug } = await params;
  const { token } = await searchParams;

  const org = await getCurrentOrganization(orgSlug);

  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  if (!token) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-bold text-gray-900">Invalid invite</h1>
        <p className="mt-2 text-sm text-gray-600">
          This invite link is missing a token. Please use the full link from your invitation.
        </p>
        <Link href="/" className="mt-4 inline-block text-blue-600 hover:underline">
          Back to OrgFlow
        </Link>
      </div>
    );
  }

  const service = createSupabaseServiceRoleClient();
  const { data: invite } = await service
    .from("invite_links")
    .select("id, organization_id, use_count, max_uses, expires_at")
    .eq("token", token)
    .eq("organization_id", org.id)
    .single();

  if (!invite) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-bold text-gray-900">Invalid invite</h1>
        <p className="mt-2 text-sm text-gray-600">
          This invite link is invalid or has expired.
        </p>
        <Link href="/" className="mt-4 inline-block text-blue-600 hover:underline">
          Back to OrgFlow
        </Link>
      </div>
    );
  }

  const expired = invite.expires_at && new Date(invite.expires_at) < new Date();
  const maxedOut = invite.max_uses != null && (invite.use_count ?? 0) >= invite.max_uses;

  if (expired || maxedOut) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-bold text-gray-900">Invite expired</h1>
        <p className="mt-2 text-sm text-gray-600">
          {expired ? "This invite link has expired." : "This invite link has reached its maximum uses."}
        </p>
        <Link href="/" className="mt-4 inline-block text-blue-600 hover:underline">
          Back to OrgFlow
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-bold text-gray-900">Join {org.name}</h1>
      <p className="mt-1 text-sm text-gray-600">
        You&apos;ve been invited to join this organisation.
      </p>
      <JoinOrgClient orgSlug={orgSlug} orgName={org.name} token={token} user={user} />
    </div>
  );
}

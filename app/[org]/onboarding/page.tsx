import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentOrganization, isOrgAdmin } from "../../../lib/getOrganization";

/**
 * Onboarding for a new organisation: authorised person sets up –
 * import members, create teams, assign admins.
 */
export default async function OnboardingPage(props: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const params = props.params;
  const orgSlug = typeof (params as Promise<{ org: string }>).then === "function"
    ? (await (params as Promise<{ org: string }>)).org
    : (params as { org: string }).org;
  const org = await getCurrentOrganization(orgSlug);

  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${orgSlug}/login?redirectTo=/${encodeURIComponent(orgSlug)}/onboarding`);

  const canAccess = await isOrgAdmin(org.id);
  if (!canAccess) redirect(`/${orgSlug}/dashboard`);

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold text-cyan-100">
        Set up organisation – {org.name}
      </h1>
      <p className="mt-1 text-sm text-cyan-300">
        As an authorised person you can set up the organisation: import members, create teams and assign admins.
      </p>

      <ol className="mt-8 space-y-6 list-decimal list-inside text-sm text-cyan-200">
        <li>
          <strong className="text-cyan-100">Members</strong>
          <p className="mt-1 text-cyan-400/80">
            In the admin area you can manage members and add them via Excel import. Download the template, fill in (Name, optional Score, Teams, Leads), then upload.
          </p>
          <Link
            href={`/${orgSlug}/admin/members`}
            className="mt-2 inline-block text-cyan-400 hover:text-cyan-300 underline"
          >
            → Members &amp; Excel import
          </Link>
        </li>
        <li>
          <strong className="text-cyan-100">Teams</strong>
          <p className="mt-1 text-cyan-400/80">
            Create and edit teams for the organisation.
          </p>
          <Link
            href={`/${orgSlug}/admin/committees`}
            className="mt-2 inline-block text-cyan-400 hover:text-cyan-300 underline"
          >
            → Teams
          </Link>
        </li>
        <li>
          <strong className="text-cyan-100">Assign admins</strong>
          <p className="mt-1 text-cyan-400/80">
            In the members area admins can change member roles (Admin/Team lead for this organisation).
          </p>
          <Link
            href={`/${orgSlug}/admin/members`}
            className="mt-2 inline-block text-cyan-400 hover:text-cyan-300 underline"
          >
            → Members &amp; roles
          </Link>
        </li>
        <li>
          <strong className="text-cyan-100">Manage everything</strong>
          <p className="mt-1 text-cyan-400/80">
            Tasks, shifts, resources and treasury – all via your organisation&apos;s admin dashboard.
          </p>
          <Link
            href={`/${orgSlug}/admin`}
            className="mt-2 inline-block rounded bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
          >
            Open admin dashboard
          </Link>
        </li>
      </ol>

      <p className="mt-8 text-xs text-cyan-400/70">
        After setup, all admins and members can use the dashboard and admin features as usual.
      </p>
    </div>
  );
}

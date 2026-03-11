import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentOrganization, isOrgAdmin } from "../../../lib/getOrganization";
import AdminBreadcrumb from "../../../components/AdminBreadcrumb";
import AdminForbidden from "../admin/AdminForbidden";

export default async function OrgSettingsPage({
  params
}: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const orgSlug =
    typeof (params as Promise<{ org: string }>).then === "function"
      ? (await (params as Promise<{ org: string }>)).org
      : (params as { org: string }).org;
  const org = await getCurrentOrganization(orgSlug);

  if (!(await isOrgAdmin(org.id))) {
    return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <AdminBreadcrumb orgSlug={orgSlug} currentLabel="Settings" />
      <h1 className="mt-4 text-2xl font-bold text-cyan-100">
        Organisation settings – {org.name}
      </h1>
      <p className="mt-1 text-sm text-cyan-300">
        Edit organisation name, teams and permissions.
      </p>

      <div className="mt-8 space-y-6">
        <section className="rounded-xl border border-cyan-500/25 bg-card/50 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-400/90 mb-4">
            Organisation
          </h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-cyan-400/80">Name</dt>
              <dd className="text-cyan-100">{org.name}</dd>
            </div>
            <div>
              <dt className="text-cyan-400/80">Slug</dt>
              <dd className="text-cyan-100 font-mono">/{org.slug}</dd>
            </div>
            {org.subdomain && (
              <div>
                <dt className="text-cyan-400/80">Subdomain</dt>
                <dd className="text-cyan-100">{org.subdomain}</dd>
              </div>
            )}
          </dl>
          <p className="mt-4 text-xs text-cyan-400/70">
            Contact your administrator to change organisation details.
          </p>
        </section>

        <section className="rounded-xl border border-cyan-500/25 bg-card/50 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-400/90 mb-4">
            Teams
          </h2>
          <Link
            href={`/${orgSlug}/admin/committees`}
            className="text-sm text-cyan-400 hover:text-cyan-300 underline"
          >
            Manage teams →
          </Link>
        </section>

        <section className="rounded-xl border border-cyan-500/25 bg-card/50 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-400/90 mb-4">
            Members & permissions
          </h2>
          <Link
            href={`/${orgSlug}/admin/members`}
            className="text-sm text-cyan-400 hover:text-cyan-300 underline"
          >
            Manage members & roles →
          </Link>
        </section>

        <Link
          href={`/${orgSlug}/admin`}
          className="inline-block rounded-lg border border-cyan-500/40 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/10"
        >
          ← Back to admin
        </Link>
      </div>
    </div>
  );
}

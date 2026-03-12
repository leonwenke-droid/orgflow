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
      <h1 className="mt-4 text-2xl font-bold text-gray-900">
        Organisation settings – {org.name}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Edit organisation name, teams and permissions.
      </p>

      <div className="mt-8 space-y-6">
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Organisation
          </h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Name</dt>
              <dd className="text-gray-900">{org.name}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Slug</dt>
              <dd className="font-mono text-gray-900">/{org.slug}</dd>
            </div>
            {org.subdomain && (
              <div>
                <dt className="text-gray-500">Subdomain</dt>
                <dd className="text-gray-900">{org.subdomain}</dd>
              </div>
            )}
          </dl>
          <p className="mt-4 text-xs text-gray-500">
            Contact your administrator to change organisation details.
          </p>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Teams
          </h2>
          <Link
            href={`/${orgSlug}/admin/committees`}
            className="text-sm text-blue-600 underline hover:text-blue-700"
          >
            Manage teams →
          </Link>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Members & permissions
          </h2>
          <Link
            href={`/${orgSlug}/admin/members`}
            className="text-sm text-blue-600 underline hover:text-blue-700"
          >
            Manage members & roles →
          </Link>
        </section>

        <Link
          href={`/${orgSlug}/admin`}
          className="inline-block rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          ← Back to admin
        </Link>
      </div>
    </div>
  );
}

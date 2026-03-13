import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentOrganization, isOrgAdmin } from "../../../lib/getOrganization";
import AdminBreadcrumb from "../../../components/AdminBreadcrumb";
import AdminForbidden from "../admin/AdminForbidden";
import ThemeToggle from "../../../components/ThemeToggle";
import LanguageToggle from "../../../components/LanguageToggle";

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
      <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-foreground-dark">
        Organization settings – {org.name}
      </h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-muted">
        Edit organization name, teams and permissions.
      </p>

      <div className="mt-8 space-y-6">
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-muted">
            Organization
          </h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-gray-500 dark:text-muted">Name</dt>
              <dd className="text-gray-900 dark:text-foreground-dark">{org.name}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-muted">Slug</dt>
              <dd className="font-mono text-gray-900 dark:text-foreground-dark">/{org.slug}</dd>
            </div>
            {org.subdomain && (
              <div>
                <dt className="text-gray-500 dark:text-muted">Subdomain</dt>
                <dd className="text-gray-900 dark:text-foreground-dark">{org.subdomain}</dd>
              </div>
            )}
          </dl>
          <p className="mt-4 text-xs text-gray-500 dark:text-muted">
            Contact your administrator to change organization details.
          </p>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-muted">
            Appearance
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <span className="text-sm text-gray-600 dark:text-muted">Toggle light/dark mode (saved in browser)</span>
            </div>
            <div className="flex items-center gap-3">
              <LanguageToggle />
              <span className="text-sm text-gray-600 dark:text-muted">Language: English / Deutsch</span>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-muted">
            Teams
          </h2>
          <Link
            href={`/${orgSlug}/admin/committees`}
            className="text-sm text-blue-600 underline hover:text-blue-700"
          >
            Manage teams →
          </Link>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-muted">
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
          className="inline-block rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          ← Back to admin
        </Link>
      </div>
    </div>
  );
}

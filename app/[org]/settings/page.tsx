import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Link from "next/link";
import { getCurrentOrganization, isOrgAdmin } from "../../../lib/getOrganization";
import AdminBreadcrumb from "../../../components/AdminBreadcrumb";
import AdminForbidden from "../admin/AdminForbidden";
import ThemeToggle from "../../../components/ThemeToggle";
import LanguageToggle from "../../../components/LanguageToggle";
import EditOrgForm from "./EditOrgForm";
import { t, localeFromCookie, LOCALE_COOKIE_NAME } from "../../../lib/i18n";

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

  const cookieStore = await cookies();
  const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

  return (
    <div className="mx-auto max-w-2xl p-6">
      <AdminBreadcrumb orgSlug={orgSlug} currentLabel={t("dashboard.settings", locale)} />
      <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-foreground-dark">
        {t("dashboard.settings", locale)} – {org.name}
      </h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-muted">
        {t("settings.edit_org", locale)}
      </p>

      <div className="mt-8 space-y-6">
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-muted">
            {t("settings.organization", locale)}
          </h2>
          {org.subdomain && (
            <p className="mb-3 text-xs text-gray-500 dark:text-muted">
              Subdomain: {org.subdomain}
            </p>
          )}
          <EditOrgForm orgSlug={orgSlug} initialName={org.name} initialSlug={org.slug} />
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-muted">
            {t("settings.appearance", locale)}
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <span className="text-sm text-gray-600 dark:text-muted">{t("settings.theme_note", locale)}</span>
            </div>
            <div className="flex items-center gap-3">
              <LanguageToggle />
              <span className="text-sm text-gray-600 dark:text-muted">{t("settings.language_note", locale)}</span>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-muted">
            {t("settings.teams_section", locale)}
          </h2>
          <Link
            href={`/${orgSlug}/admin/committees`}
            className="text-sm text-blue-600 underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {t("settings.manage_teams", locale)}
          </Link>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-muted">
            Members & permissions
          </h2>
          <Link
            href={`/${orgSlug}/admin/members`}
            className="text-sm text-blue-600 underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {t("settings.manage_members", locale)}
          </Link>
        </section>

        <Link
          href={`/${orgSlug}/admin`}
          className="inline-block rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          ← {t("settings.back_to_admin", locale)}
        </Link>
      </div>
    </div>
  );
}

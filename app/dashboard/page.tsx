import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getOrganizationsForCurrentUser, isSuperAdmin } from "../../lib/getOrganization";
import { localeFromCookie, LOCALE_COOKIE_NAME, t } from "../../lib/i18n";

export const dynamic = "force-dynamic";

/**
 * Zentrale Übersicht nach Login: alle Organisationen des Accounts.
 * Genau eine Organisation → direkt ins Org-Dashboard.
 * Organisation anlegen → gleicher Wizard wie am Desktop (/create-organisation).
 */
export default async function DashboardHubPage() {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirectTo=/dashboard");
  }

  const orgs = await getOrganizationsForCurrentUser();
  const cookieStore = await cookies();
  const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

  if (orgs.length === 1) {
    redirect(`/${orgs[0].slug}/dashboard`);
  }

  const superUser = await isSuperAdmin();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background-dark">
      <div className="mx-auto max-w-lg px-4 py-10 sm:py-14">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          {t("dashboard.hub_title", locale)}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          {t("dashboard.hub_subtitle", locale)}
        </p>
        {superUser ? (
          <p className="mt-4">
            <Link
              href="/super-admin"
              className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              {t("dashboard.hub_super_admin", locale)} →
            </Link>
          </p>
        ) : null}

        <div className="mt-8 space-y-3">
          {orgs.map((o) => (
            <Link
              key={o.id}
              href={`/${o.slug}/dashboard`}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-blue-200 hover:shadow-md dark:border-gray-700 dark:bg-card-dark dark:hover:border-blue-800"
            >
              <Building2 className="h-9 w-9 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 dark:text-gray-100">{o.name}</p>
                {o.role ? (
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">{o.role}</p>
                ) : null}
              </div>
              <span className="shrink-0 text-sm font-medium text-blue-600 dark:text-blue-400">
                {t("dashboard.hub_open", locale)}
              </span>
            </Link>
          ))}
        </div>

        {orgs.length === 0 ? (
          <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">{t("dashboard.hub_empty", locale)}</p>
        ) : null}

        <Link
          href="/create-organisation"
          className="mt-8 flex min-h-[3.5rem] items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800 transition-colors hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-800 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100 dark:hover:border-blue-700 dark:hover:bg-blue-950/30"
        >
          <Plus className="h-5 w-5 shrink-0" aria-hidden />
          {t("dashboard.hub_create", locale)}
        </Link>

        <p className="mt-8 text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
            ← OrgFlow
          </Link>
        </p>
      </div>
    </div>
  );
}

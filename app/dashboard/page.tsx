import { redirect } from "next/navigation";
import { getRequestLocale } from "../../lib/localeServer";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getOrganizationsForCurrentUser, isSuperAdmin } from "../../lib/getOrganization";
import { t } from "../../lib/i18n";

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
  const locale = await getRequestLocale();

  if (orgs.length === 1) {
    redirect(`/${orgs[0].slug}/dashboard`);
  }

  const superUser = await isSuperAdmin();

  return (
    <div className="min-h-screen bg-bg-secondary dark:bg-background-dark">
      <div className="mx-auto max-w-lg px-4 py-10 sm:py-14">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary dark:text-text-primary">
          {t("dashboard.hub_title", locale)}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary dark:text-text-muted">
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
              className="flex items-center gap-3 rounded-xl border border-border-subtle bg-bg-primary p-4 shadow-sm transition-all hover:border-blue-200 hover:shadow-md dark:border-border-default bg-card dark:hover:border-blue-800"
            >
              <Building2 className="h-9 w-9 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-text-primary dark:text-text-primary">{o.name}</p>
                {o.role ? (
                  <p className="truncate text-xs text-text-secondary dark:text-text-muted">{o.role}</p>
                ) : null}
              </div>
              <span className="shrink-0 text-sm font-medium text-blue-600 dark:text-blue-400">
                {t("dashboard.hub_open", locale)}
              </span>
            </Link>
          ))}
        </div>

        {orgs.length === 0 ? (
          <p className="mt-6 text-sm text-text-secondary dark:text-text-muted">{t("dashboard.hub_empty", locale)}</p>
        ) : null}

        <Link
          href="/create-organisation"
          className="mt-8 flex min-h-[3.5rem] items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-default bg-bg-primary px-4 py-3 text-sm font-semibold text-text-primary transition-colors hover:border-[var(--color-brand)] hover:bg-[var(--bg-brand-subtle)] hover:text-[var(--color-brand-text)] dark:border-border-default dark:bg-bg-primary/40 dark:text-text-primary dark:hover:border-[var(--color-brand)] dark:hover:bg-[var(--bg-brand-subtle)]/50"
        >
          <Plus className="h-5 w-5 shrink-0" aria-hidden />
          {t("dashboard.hub_create", locale)}
        </Link>

        <p className="mt-8 text-center">
          <Link href="/" className="text-sm text-text-secondary hover:text-text-primary dark:text-text-muted dark:hover:text-text-primary">
            ← OrgFlow
          </Link>
        </p>
      </div>
    </div>
  );
}

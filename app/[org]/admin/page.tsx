import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Link from "next/link";
import { localeFromCookie, LOCALE_COOKIE_NAME, t } from "../../../lib/i18n";
import {
  Users,
  UsersRound,
  CheckSquare,
  CalendarDays,
  CalendarRange,
  Package,
  Wallet,
  Trophy
} from "lucide-react";
import { getCurrentOrganization, isOrgAdmin, getOrgIdForData } from "../../../lib/getOrganization";
import AdminBreadcrumb from "../../../components/AdminBreadcrumb";
import AdminForbidden from "./AdminForbidden";
import EngagementScoresBlock from "./EngagementScoresBlock";

export default async function AdminDashboard({
  params
}: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const orgSlug = typeof (params as Promise<{ org: string }>).then === "function"
    ? (await (params as Promise<{ org: string }>)).org
    : (params as { org: string }).org;
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);

  if (!(await isOrgAdmin(orgIdForData))) {
    return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;
  }

  const cookieStore = await cookies();
  const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

  const authClient = createServerComponentClient({ cookies });
  const {
    data: { session }
  } = await authClient.auth.getSession();
  const currentAuthUserId = session?.user?.id ?? null;

  const features = (org.settings?.features as Record<string, boolean>) ?? {};
  const modules = {
    tasks: features.tasks !== false,
    shifts: features.shifts !== false,
    finance: features.treasury !== false,
    resources: (features.resources ?? features.materials ?? true) !== false,
    engagement: features.engagement_tracking !== false,
    events: features.events === true,
  };

  const allCards = [
    { href: `/${orgSlug}/admin/members`, icon: Users, titleKey: "admin.card.members_title", descKey: "admin.card.members_desc", show: true },
    { href: `/${orgSlug}/admin/committees`, icon: UsersRound, titleKey: "admin.card.teams_title", descKey: "admin.card.teams_desc", show: true },
    { href: `/${orgSlug}/admin/tasks`, icon: CheckSquare, titleKey: "admin.card.tasks_title", descKey: "admin.card.tasks_desc", show: modules.tasks },
    { href: `/${orgSlug}/admin/shifts`, icon: CalendarDays, titleKey: "admin.card.shifts_title", descKey: "admin.card.shifts_desc", show: modules.shifts },
    { href: `/${orgSlug}/admin/materials`, icon: Package, titleKey: "admin.card.resources_title", descKey: "admin.card.resources_desc", show: modules.resources },
    { href: `/${orgSlug}/admin/treasury`, icon: Wallet, titleKey: "admin.card.finance_title", descKey: "admin.card.finance_desc", show: modules.finance },
    { href: `/${orgSlug}/admin/scores/assign`, icon: Trophy, titleKey: "admin.card.engagement_title", descKey: "admin.card.engagement_desc", show: modules.engagement },
    { href: `/${orgSlug}/admin/events`, icon: CalendarRange, titleKey: "admin.card.events_title", descKey: "admin.card.events_desc", show: modules.events },
  ].filter((c) => c.show);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background-dark">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-10">
          <AdminBreadcrumb orgSlug={orgSlug} />
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-foreground-dark sm:text-4xl">
            {t("admin.page_title", locale)}
          </h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-muted">
            {t("admin.org_subtitle", locale).replace("{name}", org.name)}
          </p>
        </header>

        {/* Module cards */}
        <section className="mb-10">
          <h2 className="sr-only">{t("admin.modules_sr", locale)}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allCards.map(({ href, icon: Icon, titleKey, descKey }) => (
              <Link
                key={href}
                href={href}
                prefetch
                className="group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md dark:border-gray-700 dark:bg-card-dark dark:hover:border-blue-700"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-gray-800">
                  <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-foreground-dark">{t(titleKey, locale)}</p>
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-muted">{t(descKey, locale)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Engagement Scores */}
        {modules.engagement && (
          <section>
            <EngagementScoresBlock orgSlug={orgSlug} currentAuthUserId={currentAuthUserId} />
          </section>
        )}
      </div>
    </div>
  );
}


import type { ElementType } from "react";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Link from "next/link";
import type { Locale } from "../../../lib/i18n";
import { localeFromCookie, LOCALE_COOKIE_NAME, t } from "../../../lib/i18n";
import {
  Users,
  UsersRound,
  ClipboardList,
  CalendarClock,
  CalendarRange,
  Package,
  Wallet,
  Trophy,
  MessageSquare,
  Settings2
} from "lucide-react";
import {
  getCurrentOrganization,
  getCurrentUserRoleInOrg,
  getOrgIdForData,
  isOrgAdmin
} from "../../../lib/getOrganization";
import { canViewFinance } from "../../../lib/permissions";
import AdminBreadcrumb from "../../../components/AdminBreadcrumb";
import AdminForbidden from "./AdminForbidden";
import EngagementScoresBlock from "./EngagementScoresBlock";

type AdminCard = {
  href: string;
  icon: ElementType;
  titleKey: string;
  descKey: string;
  show: boolean;
};

function AdminSectionCards({
  locale,
  titleKey,
  hintKey,
  cards
}: {
  locale: Locale;
  titleKey: string;
  hintKey: string;
  cards: AdminCard[];
}) {
  const visible = cards.filter((c) => c.show);
  if (visible.length === 0) return null;
  return (
    <section className="mb-10">
      <div className="mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {t(titleKey, locale)}
        </h2>
        <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{t(hintKey, locale)}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map(({ href, icon: Icon, titleKey: tk, descKey: dk }) => (
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
              <p className="font-semibold text-gray-900 dark:text-foreground-dark">{t(tk, locale)}</p>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-muted">{t(dk, locale)}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

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

  const userRole = await getCurrentUserRoleInOrg(orgIdForData);
  const showFinanceCard = canViewFinance(userRole);

  const features = (org.settings?.features as Record<string, boolean>) ?? {};
  const modules = {
    tasks: features.tasks !== false,
    shifts: features.shifts !== false,
    finance: features.treasury !== false,
    resources: (features.resources ?? features.materials ?? true) !== false,
    engagement: features.engagement_tracking !== false,
    events: features.events === true
  };

  /** Same order and labels as Sidebar: Core (admin subset) → Organisation → Verwaltung */
  const coreCards: AdminCard[] = [
    {
      href: `/${orgSlug}/admin/members`,
      icon: Users,
      titleKey: "dashboard.members",
      descKey: "admin.card.members_desc",
      show: true
    },
    {
      href: `/${orgSlug}/admin/committees`,
      icon: UsersRound,
      titleKey: "dashboard.teams",
      descKey: "admin.card.teams_desc",
      show: true
    }
  ];

  const organisationCards: AdminCard[] = [
    {
      href: `/${orgSlug}/admin/tasks`,
      icon: ClipboardList,
      titleKey: "nav.admin_tasks",
      descKey: "admin.card.tasks_desc",
      show: modules.tasks
    },
    {
      href: `/${orgSlug}/admin/shifts`,
      icon: CalendarClock,
      titleKey: "nav.admin_shifts",
      descKey: "admin.card.shifts_desc",
      show: modules.shifts
    },
    {
      href: `/${orgSlug}/admin/materials`,
      icon: Package,
      titleKey: "dashboard.resources",
      descKey: "admin.card.resources_desc",
      show: modules.resources
    },
    {
      href: `/${orgSlug}/admin/treasury`,
      icon: Wallet,
      titleKey: "dashboard.finance",
      descKey: "admin.card.finance_desc",
      show: modules.finance && showFinanceCard
    },
    {
      href: `/${orgSlug}/admin/scores/assign`,
      icon: Trophy,
      titleKey: "dashboard.engagement",
      descKey: "admin.card.engagement_desc",
      show: modules.engagement
    },
    {
      href: `/${orgSlug}/admin/events`,
      icon: CalendarRange,
      titleKey: "events.title",
      descKey: "admin.card.events_desc",
      show: modules.events
    }
  ];

  const administrationCards: AdminCard[] = [
    {
      href: `/${orgSlug}/settings`,
      icon: Settings2,
      titleKey: "dashboard.settings",
      descKey: "settings.edit_org",
      show: true
    },
    {
      href: `/${orgSlug}/admin/feedback`,
      icon: MessageSquare,
      titleKey: "admin.card.feature_requests_title",
      descKey: "admin.card.feature_requests_desc",
      show: true
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background-dark">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-10">
          <AdminBreadcrumb orgSlug={orgSlug} />
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-foreground-dark sm:text-4xl">
            {t("admin.page_title", locale)}
          </h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-muted">
            {t("admin.org_subtitle", locale).replace("{name}", org.name)}
          </p>
        </header>

        <AdminSectionCards locale={locale} titleKey="nav.core" hintKey="admin.section.core_hint" cards={coreCards} />
        <AdminSectionCards
          locale={locale}
          titleKey="nav.organisation"
          hintKey="admin.section.org_hint"
          cards={organisationCards}
        />
        <AdminSectionCards
          locale={locale}
          titleKey="nav.administration"
          hintKey="admin.section.admin_hint"
          cards={administrationCards}
        />

        {modules.engagement && (
          <section>
            <EngagementScoresBlock orgSlug={orgSlug} currentAuthUserId={currentAuthUserId} />
          </section>
        )}
      </div>
    </div>
  );
}

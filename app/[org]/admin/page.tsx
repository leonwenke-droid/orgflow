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
  priority?: "primary" | "secondary";
  badgeKey?: string;
};

function AdminSectionCards({
  locale,
  titleKey,
  hintKey,
  cards,
  compact = false
}: {
  locale: Locale;
  titleKey: string;
  hintKey: string;
  cards: AdminCard[];
  compact?: boolean;
}) {
  const visible = cards
    .filter((c) => c.show)
    .sort((a, b) => {
      const aw = a.priority === "primary" ? 0 : 1;
      const bw = b.priority === "primary" ? 0 : 1;
      return aw - bw;
    });
  if (visible.length === 0) return null;
  return (
    <section className="mb-8">
      <div className="mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {t(titleKey, locale)}
        </h2>
        <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{t(hintKey, locale)}</p>
      </div>
      <div className={`grid grid-cols-1 ${compact ? "gap-3" : "gap-4"} sm:grid-cols-2 lg:grid-cols-3`}>
        {visible.map(({ href, icon: Icon, titleKey: tk, descKey: dk, priority, badgeKey }) => (
          <Link
            key={href}
            href={href}
            prefetch
            className={`group flex flex-col ${compact ? "gap-2.5 p-4" : "gap-3 p-5"} rounded-xl border bg-white shadow-sm transition-all dark:bg-card-dark ${
              priority === "primary"
                ? "border-blue-200 ring-1 ring-blue-100 hover:border-blue-300 hover:shadow-md dark:border-blue-800/70 dark:ring-blue-900/50"
                : "border-gray-200 hover:border-blue-200 hover:shadow-md dark:border-gray-700 dark:hover:border-blue-700"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className={`flex ${compact ? "h-9 w-9" : "h-10 w-10"} items-center justify-center rounded-lg bg-blue-50 dark:bg-gray-800`}>
                <Icon className={`${compact ? "h-4 w-4" : "h-5 w-5"} text-blue-600 dark:text-blue-400`} />
              </div>
              {badgeKey ? (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                  {t(badgeKey, locale)}
                </span>
              ) : null}
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-foreground-dark">{t(tk, locale)}</p>
              <p className={`${compact ? "mt-0.5 text-xs" : "mt-0.5 text-sm"} text-gray-500 dark:text-muted`}>{t(dk, locale)}</p>
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
  const engagementEnabled = features.engagement_tracking !== false;

  /** Same order and labels as Sidebar: Core (admin subset) → Organisation → Verwaltung */
  const coreCards: AdminCard[] = [
    {
      href: `/${orgSlug}/admin/members`,
      icon: Users,
      titleKey: "dashboard.members",
      descKey: "admin.card.members_desc",
      show: true,
      priority: "secondary"
    },
    {
      href: `/${orgSlug}/admin/committees`,
      icon: UsersRound,
      titleKey: "dashboard.teams",
      descKey: "admin.card.teams_desc",
      show: true,
      priority: "secondary"
    }
  ];

  const organisationCards: AdminCard[] = [
    {
      href: `/${orgSlug}/admin/tasks`,
      icon: ClipboardList,
      titleKey: "nav.admin_tasks",
      descKey: "admin.card.tasks_desc",
      show: true,
      priority: "primary",
      badgeKey: "admin.badge.priority"
    },
    {
      href: `/${orgSlug}/admin/shifts`,
      icon: CalendarClock,
      titleKey: "nav.admin_shifts",
      descKey: "admin.card.shifts_desc",
      show: true,
      priority: "primary",
      badgeKey: "admin.badge.priority"
    },
    {
      href: `/${orgSlug}/admin/materials`,
      icon: Package,
      titleKey: "dashboard.resources",
      descKey: "admin.card.resources_desc",
      show: true,
      priority: "secondary"
    },
    {
      href: `/${orgSlug}/admin/treasury`,
      icon: Wallet,
      titleKey: "dashboard.finance",
      descKey: "admin.card.finance_desc",
      show: showFinanceCard,
      priority: "secondary"
    },
    {
      href: `/${orgSlug}/admin/scores/assign`,
      icon: Trophy,
      titleKey: "dashboard.engagement",
      descKey: "admin.card.engagement_desc",
      show: true,
      priority: "secondary"
    },
    {
      href: `/${orgSlug}/admin/events`,
      icon: CalendarRange,
      titleKey: "events.title",
      descKey: "admin.card.events_desc",
      show: true,
      priority: "secondary"
    },
    {
      href: `/${orgSlug}/admin/overview`,
      icon: CalendarRange,
      titleKey: "admin.card.overview_title",
      descKey: "admin.card.overview_desc",
      show: true,
      priority: "primary",
      badgeKey: "admin.badge.new"
    }
  ];

  const administrationCards: AdminCard[] = [
    {
      href: `/${orgSlug}/settings`,
      icon: Settings2,
      titleKey: "dashboard.settings",
      descKey: "settings.edit_org",
      show: true,
      priority: "secondary"
    },
    {
      href: `/${orgSlug}/admin/feedback`,
      icon: MessageSquare,
      titleKey: "admin.card.feature_requests_title",
      descKey: "admin.card.feature_requests_desc",
      show: true,
      priority: "secondary"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background-dark">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <AdminBreadcrumb orgSlug={orgSlug} />
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-foreground-dark sm:text-3xl">
            {t("admin.page_title", locale)}
          </h1>
          <p className="mt-1.5 text-sm text-gray-600 dark:text-muted">
            {t("admin.org_subtitle", locale).replace("{name}", org.name)}
          </p>
        </header>

        <AdminSectionCards locale={locale} titleKey="nav.my_area" hintKey="admin.section.core_hint" cards={coreCards} />
        <AdminSectionCards
          locale={locale}
          titleKey="nav.manage_org"
          hintKey="admin.section.org_hint"
          cards={organisationCards}
        />
        <AdminSectionCards
          locale={locale}
          titleKey="nav.manage_org"
          hintKey="admin.section.admin_hint"
          cards={administrationCards}
          compact
        />

        {engagementEnabled && (
          <section id="admin-engagement" className="mt-8 scroll-mt-8">
            <EngagementScoresBlock orgSlug={orgSlug} currentAuthUserId={currentAuthUserId} />
          </section>
        )}
      </div>
    </div>
  );
}

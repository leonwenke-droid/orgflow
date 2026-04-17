"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import LogoutButton from "./LogoutButton";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";
import {
  LayoutDashboard,
  LayoutGrid,
  CheckSquare,
  CalendarDays,
  CalendarClock,
  CalendarRange,
  ClipboardList,
  Users,
  UsersRound,
  Package,
  Wallet,
  Trophy,
  BarChart3,
  MessageSquare,
  UserCircle,
  Settings2,
  PanelsTopLeft,
} from "lucide-react";
import SidebarMultiOrgLink from "./SidebarMultiOrgLink";
import type { AppShellUser } from "./AppShell";
import type { DbRole } from "../types";
import {
  canAccessOperationalAdmin,
  canManageMembersAndTeams,
  canViewFinance,
} from "../lib/permissions";

const RESERVED = [
  "admin",
  "dashboard",
  "login",
  "super-admin",
  "task",
  "api",
  "claim-org",
  "auth",
  "create-organisation",
  "join",
  "imprint",
  "privacy",
  "terms",
  "invite",
  "onboarding",
  "avv",
];

type NavItem = { href: string; labelKey: string; icon: React.ElementType };

type OrgModules = {
  tasks?: boolean;
  shifts?: boolean;
  finance?: boolean;
  resources?: boolean;
  engagement?: boolean;
  events?: boolean;
};

function getNavSections(
  org: string,
  modules?: OrgModules,
  role?: DbRole | null
): { titleKey: string; items: NavItem[] }[] {
  const m = modules ?? {};
  const eventsVisible = m.events !== false;
  const financeModuleOn = m.finance !== false;
  const financeOk = role != null && financeModuleOn && canViewFinance(role);
  const operational = canAccessOperationalAdmin(role);
  const fullControl = canManageMembersAndTeams(role);

  const tasksHref = `/${org}/tasks`;
  const shiftsHref = `/${org}/shifts`;
  const treasuryHref = `/${org}/admin/finanzen`;
  /** Gemeinsame Gesamtübersicht für alle Rollen (Owner, Admin, Member, Viewer). */
  const overviewHref = `/${org}/overview`;

  if (role === "viewer") {
    const myArea: NavItem[] = [
      { href: overviewHref, labelKey: "nav.org_overview", icon: PanelsTopLeft },
      { href: `/${org}/account`, labelKey: "nav.my_account", icon: UserCircle },
    ];
    const sections: { titleKey: string; items: NavItem[] }[] = [{ titleKey: "nav.my_area", items: myArea }];
    sections.push({
      titleKey: "",
      items: [{ href: `/${org}/feedback`, labelKey: "nav.feedback", icon: MessageSquare }],
    });
    return sections.filter((s) => s.items.length > 0);
  }

  const myArea: NavItem[] = [
    { href: `/${org}/dashboard`, labelKey: "dashboard.title", icon: LayoutDashboard },
    { href: overviewHref, labelKey: "nav.org_overview", icon: PanelsTopLeft },
    ...(m.tasks !== false ? [{ href: tasksHref, labelKey: "dashboard.tasks", icon: CheckSquare }] : []),
    ...(m.shifts !== false ? [{ href: shiftsHref, labelKey: "dashboard.shifts", icon: CalendarDays }] : []),
    { href: `/${org}/me`, labelKey: "nav.my_stats", icon: BarChart3 },
    { href: `/${org}/account`, labelKey: "nav.my_account", icon: UserCircle },
  ];

  const sections: { titleKey: string; items: NavItem[] }[] = [{ titleKey: "nav.my_area", items: myArea }];

  if (operational) {
    const adminItems: NavItem[] = [{ href: `/${org}/admin`, labelKey: "nav.admin_hub", icon: LayoutGrid }];
    if (fullControl) {
      adminItems.push(
        { href: `/${org}/admin/members`, labelKey: "dashboard.members", icon: Users },
        { href: `/${org}/admin/committees`, labelKey: "dashboard.teams", icon: UsersRound }
      );
    }
    if (m.tasks !== false) adminItems.push({ href: `/${org}/admin/tasks`, labelKey: "nav.admin_tasks", icon: ClipboardList });
    if (m.shifts !== false) adminItems.push({ href: `/${org}/admin/shifts`, labelKey: "nav.admin_shifts", icon: CalendarClock });
    if (m.resources !== false) adminItems.push({ href: `/${org}/admin/materials`, labelKey: "dashboard.resources", icon: Package });
    if (eventsVisible) adminItems.push({ href: `/${org}/admin/events`, labelKey: "events.title", icon: CalendarRange });
    if (financeOk) adminItems.push({ href: treasuryHref, labelKey: "dashboard.finance", icon: Wallet });
    if (m.engagement !== false) adminItems.push({ href: `/${org}/admin/scores/assign`, labelKey: "dashboard.engagement", icon: Trophy });
    if (fullControl) adminItems.push({ href: `/${org}/settings`, labelKey: "dashboard.settings", icon: Settings2 });
    sections.push({ titleKey: "nav.manage_org", items: adminItems });
  } else if (financeOk) {
    sections[0].items.push({ href: treasuryHref, labelKey: "dashboard.finance", icon: Wallet });
  }

  sections.push({
    titleKey: "",
    items: [{ href: `/${org}/feedback`, labelKey: "nav.feedback", icon: MessageSquare }],
  });

  return sections.filter((s) => s.items.length > 0);
}

export default function Sidebar({
  user,
  orgSlug,
  mobileOpen,
  onClose,
}: {
  user: AppShellUser;
  orgSlug: string | null;
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const { locale } = useLocale();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const [orgName, setOrgName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [modules, setModules] = useState<OrgModules | null>(null);
  const [role, setRole] = useState<DbRole | null>(null);
  const [openTaskCount, setOpenTaskCount] = useState<number>(0);
  const [upcomingShiftCount, setUpcomingShiftCount] = useState<number>(0);

  useEffect(() => {
    if (!orgSlug) {
      setOrgName(null);
      setLogoUrl(null);
      setModules(null);
      setOpenTaskCount(0);
      setUpcomingShiftCount(0);
      return;
    }
    let cancelled = false;
    fetch(`/api/org-settings?slug=${encodeURIComponent(orgSlug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          if (data.name) setOrgName(data.name);
          setLogoUrl(typeof data.logoUrl === "string" && data.logoUrl.trim() ? data.logoUrl.trim() : null);
          if (data.modules) setModules(data.modules);
          setRole((data.role as DbRole | undefined) ?? null);
          setOpenTaskCount(typeof data.openTaskCount === "number" ? data.openTaskCount : 0);
          setUpcomingShiftCount(typeof data.upcomingShiftCount === "number" ? data.upcomingShiftCount : 0);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [orgSlug]);

  if (!orgSlug || !user) return null;

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    const currentOrg = searchParams?.get("org")?.trim() || null;
    // Admin hub: nur exakte Route, nicht alle /admin/*-Unterseiten
    if (href === `/${orgSlug}/admin`) {
      return pathname === `/${orgSlug}/admin`;
    }
    if (href === `/${orgSlug}/overview`) {
      return pathname === `/${orgSlug}/overview`;
    }
    if (href === `/${orgSlug}/admin/overview`) {
      return pathname.startsWith(`/${orgSlug}/admin/overview`);
    }
    if (href === `/${orgSlug}/settings`) {
      return pathname === `/${orgSlug}/settings` || pathname.startsWith(`/${orgSlug}/settings/`);
    }
    if (href === `/${orgSlug}/feedback`) {
      return pathname.startsWith(`/${orgSlug}/feedback`);
    }
    if (href === `/${orgSlug}/admin/events`) {
      return pathname.startsWith(`/${orgSlug}/admin/events`);
    }
    if (href.includes("/admin/materials"))
      return (pathname === "/admin/materials" && currentOrg === orgSlug) || pathname.startsWith(`/${orgSlug}/admin/materials`);
    if (href.includes("/admin/finanzen")) {
      return pathname === `/${orgSlug}/admin/finanzen`;
    }
    if (href.includes("/admin/tasks"))
      return (pathname === "/admin/tasks" && currentOrg === orgSlug) || pathname.startsWith(`/${orgSlug}/admin/tasks`);
    if (href.includes("/admin/shifts"))
      return (pathname === "/admin/shifts" && currentOrg === orgSlug) || pathname.startsWith(`/${orgSlug}/admin/shifts`);
    if (href.includes("/account")) return pathname === `/${orgSlug}/account` || pathname.startsWith(`/${orgSlug}/account`);
    return pathname === href || (href !== `/${orgSlug}/dashboard` && pathname.startsWith(href));
  };

  const linkClassName = (href: string) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
      isActive(href)
        ? "bg-[var(--bg-primary)] text-text-primary font-medium dark:bg-bg-primary/12"
        : "text-text-muted hover:bg-bg-secondary hover:text-text-primary dark:hover:bg-bg-primary/8 dark:hover:text-text-primary"
    }`;

  const initials = (orgName ?? orgSlug).slice(0, 2).toUpperCase();

  const sidebarContent = (
    <>
      <div className="px-4 py-4">
        <div className="flex items-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-supplied org logo URL
            <img
              src={logoUrl}
              alt=""
              className="h-7 w-7 shrink-0 rounded-[7px] border border-[var(--border-subtle)] object-cover dark:border-white/10"
            />
          ) : (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-brand-light text-xs font-semibold text-brand-dark">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-text-primary" title={orgName ?? orgSlug}>
              {orgName ?? orgSlug}
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {getNavSections(orgSlug, modules ?? undefined, role).map((section, idx) => (
          <div key={`${section.titleKey}-${idx}`} className={idx === 0 ? "" : "mt-6"}>
            {section.titleKey ? <div className="section-label px-3">{t(section.titleKey, locale)}</div> : null}
            <div className="mt-2 space-y-1">
              {section.items.map(({ href, labelKey, icon: Icon }) => {
                const showTaskBadge = labelKey === "dashboard.tasks" && openTaskCount > 0;
                const showShiftBadge = labelKey === "dashboard.shifts" && upcomingShiftCount > 0;
                return (
                  <Link key={href} href={href} prefetch className={linkClassName(href)} onClick={onClose}>
                    <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    <span className="min-w-0 truncate">{t(labelKey, locale)}</span>
                    {showShiftBadge && (
                      <span className="ml-auto text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5 font-medium">
                        {upcomingShiftCount}
                      </span>
                    )}
                    {showTaskBadge && (
                      <span className="ml-auto text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5 font-medium">
                        {openTaskCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        <SidebarMultiOrgLink linkClassName={linkClassName} onClose={onClose} />
      </nav>

      <div className="mt-auto px-3 pb-4">
        <LogoutButton returnTo={`/${orgSlug}/login`} />
      </div>
    </>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border-subtle bg-bg-app/70 backdrop-blur dark:border-border-subtle dark:bg-bg-app/92 lg:flex">
        {sidebarContent}
      </aside>
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={onClose}
            aria-hidden
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border-subtle bg-bg-app/92 shadow-xl backdrop-blur dark:border-border-subtle dark:bg-bg-app/95 lg:hidden">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}

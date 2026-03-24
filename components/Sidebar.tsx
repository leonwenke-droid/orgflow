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
  ShieldCheck,
  Settings2,
  PanelsTopLeft,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
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

function getNavSections(org: string, modules?: OrgModules, role?: DbRole | null): { titleKey: string; items: NavItem[] }[] {
  const m = modules ?? {};
  const eventsVisible = m.events !== false;
  const financeModuleOn = m.finance !== false;
  const financeOk = role != null && financeModuleOn && canViewFinance(role);
  const operational = canAccessOperationalAdmin(role);
  const fullControl = canManageMembersAndTeams(role);

  const tasksHref = `/${org}/tasks`;
  const shiftsHref = `/${org}/shifts`;
  const treasuryHref = `/admin/treasury?org=${encodeURIComponent(org)}`;

  const myArea: NavItem[] = [
    { href: `/${org}/dashboard`, labelKey: "dashboard.title", icon: LayoutDashboard },
    { href: `/${org}/admin/overview`, labelKey: "nav.org_overview", icon: PanelsTopLeft },
    ...(m.tasks !== false ? [{ href: tasksHref, labelKey: "dashboard.tasks", icon: CheckSquare }] : []),
    ...(m.shifts !== false ? [{ href: shiftsHref, labelKey: "dashboard.shifts", icon: CalendarDays }] : []),
    { href: `/${org}/me`, labelKey: "nav.my_stats", icon: BarChart3 },
    { href: `/${org}/account`, labelKey: "nav.my_account", icon: UserCircle },
  ];

  if (financeOk && !operational) {
    myArea.push({ href: treasuryHref, labelKey: "dashboard.finance", icon: Wallet });
  }

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
    if (m.engagement !== false) {
      adminItems.push({ href: `/${org}/admin/scores/assign`, labelKey: "dashboard.engagement", icon: Trophy });
    }
    if (fullControl) {
      adminItems.push({ href: `/${org}/settings`, labelKey: "dashboard.settings", icon: Settings2 });
    }
    sections.push({ titleKey: "nav.manage_org", items: adminItems });
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
  user: User | null;
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

  useEffect(() => {
    if (!orgSlug) {
      setOrgName(null);
      setLogoUrl(null);
      setModules(null);
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
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [orgSlug]);

  if (!orgSlug || !user) return null;

  const isActive = (href: string) => {
    const currentOrg = searchParams?.get("org")?.trim() || null;
    // Admin hub: nur exakte Route, nicht alle /admin/*-Unterseiten
    if (href === `/${orgSlug}/admin`) {
      return pathname === `/${orgSlug}/admin`;
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
    if (href.includes("/admin/treasury")) {
      const qOrg = searchParams?.get("org")?.trim() || currentOrg;
      return pathname === "/admin/treasury" && qOrg === orgSlug;
    }
    if (href.includes("/admin/tasks"))
      return (pathname === "/admin/tasks" && currentOrg === orgSlug) || pathname.startsWith(`/${orgSlug}/admin/tasks`);
    if (href.includes("/admin/shifts"))
      return (pathname === "/admin/shifts" && currentOrg === orgSlug) || pathname.startsWith(`/${orgSlug}/admin/shifts`);
    if (href.includes("/account")) return pathname === `/${orgSlug}/account` || pathname.startsWith(`/${orgSlug}/account`);
    return pathname === href || (href !== `/${orgSlug}/dashboard` && pathname.startsWith(href));
  };

  const linkClassName = (href: string) =>
    `flex items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm font-medium transition-colors ${
      isActive(href)
        ? "border-blue-600 bg-blue-50 text-blue-600 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-400"
        : "border-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
    }`;

  const sidebarContent = (
    <>
      <div className="flex h-14 items-center border-b border-gray-200 px-5 dark:border-gray-700">
        <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">OrgFlow</span>
      </div>
      {orgName && (
        <div className="border-b border-gray-200 px-3 py-3 dark:border-gray-700">
          <div className="flex items-center gap-2 rounded-lg px-2 py-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- user-supplied org logo URL
              <img
                src={logoUrl}
                alt=""
                className="h-7 w-7 shrink-0 rounded-md border border-gray-200 object-cover dark:border-gray-600"
              />
            ) : (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                {orgName.substring(0, 2).toUpperCase()}
              </div>
            )}
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100" title={orgName}>
              {orgName}
            </span>
          </div>
        </div>
      )}
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {getNavSections(orgSlug, modules ?? undefined, role).map((section, idx) => (
          <div key={`${section.titleKey}-${idx}`}>
            {idx > 0 ? (
              <div className="my-3 border-t border-gray-200 dark:border-gray-800" aria-hidden />
            ) : null}
            {section.titleKey ? (
              <div className="mb-1 flex items-center gap-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {section.titleKey === "nav.manage_org" ? (
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                ) : null}
                <span>{t(section.titleKey, locale)}</span>
              </div>
            ) : null}
            <div className="space-y-0.5">
              {section.items.map(({ href, labelKey, icon: Icon }) => (
                <Link key={href} href={href} prefetch className={linkClassName(href)}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 truncate">{t(labelKey, locale)}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="shrink-0 border-t border-gray-200 px-3 py-3 dark:border-gray-700">
        <LogoutButton returnTo={`/${orgSlug}/login`} />
      </div>
    </>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 lg:flex">
        {sidebarContent}
      </aside>
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={onClose}
            aria-hidden
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900 lg:hidden">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}

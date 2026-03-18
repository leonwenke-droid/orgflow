"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import FullPageLink from "./FullPageLink";
import LogoutButton from "./LogoutButton";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";
import {
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
  CalendarRange,
  Users,
  UsersRound,
  Package,
  Wallet,
  Trophy,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

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

function getNavSections(org: string, modules?: OrgModules, canViewFinance?: boolean): { titleKey: string; items: NavItem[] }[] {
  const m = modules ?? {};
  const showFinance = (m.finance !== false) && (canViewFinance !== false);
  const core: NavItem[] = [
    { href: `/${org}/dashboard`, labelKey: "dashboard.title", icon: LayoutDashboard },
    ...(m.tasks !== false ? [{ href: `/${org}/admin/tasks`, labelKey: "dashboard.tasks", icon: CheckSquare }] : []),
    ...(m.shifts !== false ? [{ href: `/${org}/admin/shifts`, labelKey: "dashboard.shifts", icon: CalendarDays }] : []),
    { href: `/${org}/admin/members`, labelKey: "dashboard.members", icon: Users },
    { href: `/${org}/admin/committees`, labelKey: "dashboard.teams", icon: UsersRound },
  ];
  const orgItems: NavItem[] = [
    ...(m.resources !== false ? [{ href: `/${org}/admin/materials`, labelKey: "dashboard.resources", icon: Package }] : []),
    ...(showFinance ? [{ href: `/${org}/admin/treasury`, labelKey: "dashboard.finance", icon: Wallet }] : []),
    ...(m.engagement !== false ? [{ href: `/${org}/admin/scores/assign`, labelKey: "dashboard.engagement", icon: Trophy }] : []),
    ...(m.events ? [{ href: `/${org}/admin/events`, labelKey: "events.title", icon: CalendarRange }] : []),
  ];
  return [
    { titleKey: "nav.core", items: core },
    { titleKey: "nav.organisation", items: orgItems },
    { titleKey: "nav.administration", items: [{ href: `/${org}/settings`, labelKey: "dashboard.settings", icon: Settings2 }, { href: `/${org}/admin`, labelKey: "dashboard.admin", icon: ShieldCheck }] },
  ];
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
  const [modules, setModules] = useState<OrgModules | null>(null);
  const [canViewFinance, setCanViewFinance] = useState<boolean>(true);

  useEffect(() => {
    if (!orgSlug) {
      setOrgName(null);
      setModules(null);
      setCanViewFinance(true);
      return;
    }
    let cancelled = false;
    fetch(`/api/org-settings?slug=${encodeURIComponent(orgSlug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          if (data.name) setOrgName(data.name);
          if (data.modules) setModules(data.modules);
          setCanViewFinance(data.canViewFinance !== false);
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
    if (href.includes("/admin/materials"))
      return (pathname === "/admin/materials" && currentOrg === orgSlug) || pathname.startsWith(`/${orgSlug}/admin/materials`);
    if (href.includes("/admin/treasury"))
      return (pathname === "/admin/treasury" && currentOrg === orgSlug) || pathname.startsWith(`/${orgSlug}/admin/treasury`);
    if (href.includes("/admin/tasks"))
      return (pathname === "/admin/tasks" && currentOrg === orgSlug) || pathname.startsWith(`/${orgSlug}/admin/tasks`);
    if (href.includes("/admin/shifts"))
      return (pathname === "/admin/shifts" && currentOrg === orgSlug) || pathname.startsWith(`/${orgSlug}/admin/shifts`);
    return pathname === href || (href !== `/${orgSlug}/dashboard` && pathname.startsWith(href));
  };

  const linkClassName = (href: string) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive(href)
        ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
    }`;

  const sidebarContent = (
    <>
      <div className="flex h-14 items-center border-b border-gray-200 px-5 dark:border-gray-700">
        <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">OrgFlow</span>
      </div>
      {orgName && (
        <div className="border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">{orgName}</p>
        </div>
      )}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {getNavSections(orgSlug, modules ?? undefined, canViewFinance)
        .filter((s) => s.items.length > 0)
        .map((section) => (
          <div key={section.titleKey}>
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t(section.titleKey, locale)}
            </p>
            <div className="space-y-0.5">
              {section.items.map(({ href, labelKey, icon: Icon }) => (
                <FullPageLink key={href} href={href} className={linkClassName(href)}>
                  <Icon className="h-4 w-4 shrink-0" />
                  {t(labelKey, locale)}
                </FullPageLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="shrink-0 border-t border-gray-200 px-3 py-3 dark:border-gray-700">
        <LogoutButton returnTo={`/${orgSlug}/dashboard`} />
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

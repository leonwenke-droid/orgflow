"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, CalendarDays, CheckSquare, UserCircle, PanelsTopLeft } from "lucide-react";
import { useLocale } from "../LocaleProvider";
import { t } from "../../lib/i18n";
import type { AppShellUser } from "../AppShell";
import type { DbRole } from "../../types";

type NavItem = {
  href: string;
  labelKey: string;
  icon: React.ElementType;
};

/**
 * Bottom navigation for viewports &lt; md (768px). Four primary actions: Dashboard, Schichten, Aufgaben, Konto.
 * Hidden on md+ where the desktop sidebar is available.
 * z-30 — below modals (z-[100]) and mobile sidebar (z-[38–45]).
 */
export default function MobileNav({
  user,
  orgSlug
}: {
  user: AppShellUser;
  orgSlug: string | null;
}) {
  const { locale } = useLocale();
  const pathname = usePathname() ?? "";
  const [role, setRole] = useState<DbRole | null>(null);
  const [openTaskCount, setOpenTaskCount] = useState<number>(0);
  const [upcomingShiftCount, setUpcomingShiftCount] = useState<number>(0);

  useEffect(() => {
    if (!orgSlug) {
      setRole(null);
      setOpenTaskCount(0);
      setUpcomingShiftCount(0);
      return;
    }
    let cancelled = false;
    const load = () => {
      fetch(`/api/org-settings?slug=${encodeURIComponent(orgSlug)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled) return;
          if (data?.role) setRole(data.role as DbRole);
          else setRole(null);
          setOpenTaskCount(typeof data?.openTaskCount === "number" ? data.openTaskCount : 0);
          setUpcomingShiftCount(typeof data?.upcomingShiftCount === "number" ? data.upcomingShiftCount : 0);
        })
        .catch(() => {
          if (!cancelled) {
            setRole(null);
            setOpenTaskCount(0);
            setUpcomingShiftCount(0);
          }
        });
    };
    load();
    const onFocus = () => load();
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    const id = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(id);
    };
  }, [orgSlug]);

  if (!orgSlug || !user) return null;

  const base = `/${orgSlug}`;
  const items: NavItem[] =
    role === "viewer"
      ? [
          { href: `${base}/overview`, labelKey: "nav.org_overview", icon: PanelsTopLeft },
          { href: `${base}/account`, labelKey: "nav.my_account", icon: UserCircle },
        ]
      : [
          { href: `${base}/dashboard`, labelKey: "dashboard.title", icon: LayoutDashboard },
          { href: `${base}/shifts`, labelKey: "dashboard.shifts", icon: CalendarDays },
          { href: `${base}/tasks`, labelKey: "dashboard.tasks", icon: CheckSquare },
          { href: `${base}/account`, labelKey: "nav.my_account", icon: UserCircle },
        ];

  const isActive = (href: string) => {
    if (href.includes("/account")) {
      return pathname === href || pathname.startsWith(`${href}/`);
    }
    if (href.endsWith("/overview")) {
      return pathname === href;
    }
    if (href.endsWith("/dashboard")) {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex items-stretch justify-around gap-0 border-t border-border-subtle bg-bg-primary/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur supports-[backdrop-filter]:bg-bg-primary/80 md:hidden dark:border-border-default dark:bg-bg-primary/95 dark:supports-[backdrop-filter]:bg-bg-primary/80"
      aria-label={t("nav.mobile_nav", locale)}
    >
      {items.map(({ href, labelKey, icon: Icon }) => {
        const active = isActive(href);
        const badge =
          labelKey === "dashboard.tasks"
            ? openTaskCount
            : labelKey === "dashboard.shifts"
              ? upcomingShiftCount
              : 0;
        return (
          <Link
            key={href}
            href={href}
            prefetch
            className={
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-medium transition-colors sm:text-[11px] " +
              (active
                ? "text-blue-600 dark:text-blue-400"
                : "text-text-secondary hover:text-text-primary dark:text-text-muted dark:hover:text-text-primary")
            }
            aria-current={active ? "page" : undefined}
          >
            <span className="relative">
              <Icon
                className={
                  "h-5 w-5 shrink-0 " +
                  (active ? "text-blue-600 dark:text-blue-400" : "text-text-muted dark:text-text-secondary")
                }
                strokeWidth={active ? 2.25 : 2}
                aria-hidden
              />
              {badge > 0 ? (
                <span className="absolute -right-2 -top-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-white">
                  {badge}
                </span>
              ) : null}
            </span>
            <span className="max-w-full truncate text-center leading-tight">{t(labelKey, locale)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

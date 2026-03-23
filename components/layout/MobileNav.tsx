"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarDays, CheckSquare, UserCircle } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useLocale } from "../LocaleProvider";
import { t } from "../../lib/i18n";

type NavItem = {
  href: string;
  labelKey: string;
  icon: React.ElementType;
};

/**
 * Bottom navigation for viewports &lt; md (768px). Four primary actions: Dashboard, Schichten, Aufgaben, Konto.
 * Hidden on md+ where the desktop sidebar is available.
 */
export default function MobileNav({
  user,
  orgSlug
}: {
  user: User | null;
  orgSlug: string | null;
}) {
  const { locale } = useLocale();
  const pathname = usePathname() ?? "";

  if (!orgSlug || !user) return null;

  const base = `/${orgSlug}`;
  const items: NavItem[] = [
    { href: `${base}/dashboard`, labelKey: "dashboard.title", icon: LayoutDashboard },
    { href: `${base}/shifts`, labelKey: "dashboard.shifts", icon: CalendarDays },
    { href: `${base}/tasks`, labelKey: "dashboard.tasks", icon: CheckSquare },
    { href: `${base}/account`, labelKey: "nav.my_account", icon: UserCircle }
  ];

  const isActive = (href: string) => {
    if (href.includes("/account")) {
      return pathname === href || pathname.startsWith(`${href}/`);
    }
    if (href.endsWith("/dashboard")) {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-around gap-0 border-t border-gray-200 bg-white/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur supports-[backdrop-filter]:bg-white/80 md:hidden dark:border-gray-700 dark:bg-gray-900/95 dark:supports-[backdrop-filter]:bg-gray-900/80"
      aria-label={t("nav.mobile_nav", locale)}
    >
      {items.map(({ href, labelKey, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            prefetch
            className={
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-medium transition-colors sm:text-[11px] " +
              (active
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100")
            }
            aria-current={active ? "page" : undefined}
          >
            <Icon
              className={
                "h-5 w-5 shrink-0 " +
                (active ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500")
              }
              strokeWidth={active ? 2.25 : 2}
              aria-hidden
            />
            <span className="max-w-full truncate text-center leading-tight">{t(labelKey, locale)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

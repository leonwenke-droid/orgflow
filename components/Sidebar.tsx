"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import FullPageLink from "./FullPageLink";
import LogoutButton from "./LogoutButton";
import {
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
  Users,
  Package,
  Wallet,
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
];

const navItems = (org: string) => [
  { href: `/${org}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
  { href: `/admin/tasks?org=${encodeURIComponent(org)}`, label: "Tasks", icon: CheckSquare },
  { href: `/admin/shifts?org=${encodeURIComponent(org)}`, label: "Shifts", icon: CalendarDays },
  { href: `/${org}/admin/members`, label: "Members", icon: Users },
  { href: `/admin/materials?org=${encodeURIComponent(org)}`, label: "Resources", icon: Package },
  { href: `/admin/treasury?org=${encodeURIComponent(org)}`, label: "Finance", icon: Wallet },
];

const bottomItems = (org: string) => [
  { href: `/${org}/admin`, label: "Admin", icon: ShieldCheck },
  { href: `/${org}/settings`, label: "Settings", icon: Settings2 },
];

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
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const [orgName, setOrgName] = useState<string | null>(null);

  useEffect(() => {
    if (!orgSlug) {
      setOrgName(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/org-name?slug=${encodeURIComponent(orgSlug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.name) setOrgName(data.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [orgSlug]);

  if (!orgSlug || !user) return null;

  const isActive = (href: string) => {
    if (href.startsWith("/admin/")) {
      const base = href.split("?")[0];
      const currentOrg = searchParams?.get("org")?.trim() || null;
      return pathname.startsWith(base) && currentOrg === orgSlug;
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  const linkClassName = (href: string) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive(href)
        ? "bg-blue-50 text-blue-600"
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    }`;

  const sidebarContent = (
    <>
      <div className="flex h-14 items-center px-5 border-b border-gray-200">
        <span className="text-lg font-bold tracking-tight text-gray-900">OrgFlow</span>
      </div>
      {orgName && (
        <div className="border-b border-gray-200 px-5 py-3">
          <p className="truncate text-xs text-gray-500">{orgName}</p>
        </div>
      )}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {navItems(orgSlug).map(({ href, label, icon: Icon }) => (
          <FullPageLink key={href} href={href} className={linkClassName(href)}>
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </FullPageLink>
        ))}
      </nav>
      <div className="space-y-0.5 border-t border-gray-200 px-3 py-3">
        {bottomItems(orgSlug).map(({ href, label, icon: Icon }) => (
          <FullPageLink key={href} href={href} className={linkClassName(href)}>
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </FullPageLink>
        ))}
        <div className="pt-2">
          <LogoutButton returnTo={`/${orgSlug}/dashboard`} />
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: always visible */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-gray-200 bg-white lg:flex">
        {sidebarContent}
      </aside>
      {/* Mobile: overlay when open */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={onClose}
            aria-hidden
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-gray-200 bg-white shadow-xl lg:hidden">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}

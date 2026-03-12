"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Suspense } from "react";
import type { User } from "@supabase/supabase-js";
import { Menu } from "lucide-react";
import FullPageLink from "./FullPageLink";
import LogoutButton from "./LogoutButton";
import ThemeToggle from "./ThemeToggle";

const RESERVED = ["admin", "dashboard", "login", "super-admin", "task", "api", "claim-org", "auth", "create-organisation", "join"];

function useOrgSlug(): string | null {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const segments = pathname.split("/").filter(Boolean);
  const orgFromPath = segments.length >= 1 && !RESERVED.includes(segments[0]) ? segments[0] : null;
  const orgFromQuery = searchParams?.get("org")?.trim() || null;
  return orgFromPath || orgFromQuery;
}

export default function AppHeader({ user, onMenuOpen }: { user: User | null; onMenuOpen?: () => void }) {
  const pathname = usePathname() ?? "";
  const orgSlug = useOrgSlug();
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
    return () => { cancelled = true; };
  }, [orgSlug]);

  // Hide header on landing, auth, claim and create-organisation
  if (pathname === "/" || pathname.startsWith("/auth") || pathname.startsWith("/claim-org") || pathname.startsWith("/create-organisation") || pathname.startsWith("/join")) return null;

  const logoutReturnTo = pathname.startsWith("/super-admin")
    ? "/login?redirectTo=/super-admin"
    : orgSlug ? `/${orgSlug}/dashboard` : "/";

  return (
    <header className="mb-6 flex items-center justify-between" role="banner">
      <div className="flex items-center gap-3">
        {onMenuOpen && (
          <button
            type="button"
            onClick={onMenuOpen}
            className="lg:hidden rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          {orgName ? `OrgFlow – ${orgName}` : "OrgFlow"}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        {!user && orgSlug && (
          <FullPageLink
            href={`/${orgSlug}/login`}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
          >
            Sign in
          </FullPageLink>
        )}
        {user && !pathname.startsWith("/auth") && !pathname.startsWith("/claim-org") && (
          <LogoutButton returnTo={logoutReturnTo} />
        )}
      </div>
    </header>
  );
}

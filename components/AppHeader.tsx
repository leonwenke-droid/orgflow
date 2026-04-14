"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Suspense } from "react";
import { Menu } from "lucide-react";
import FullPageLink from "./FullPageLink";
import LogoutButton from "./LogoutButton";
import ThemeToggle from "./ThemeToggle";
import NotificationBell from "./NotificationBell";
import { OrgFlowLogoLockup } from "./brand/OrgFlowLogoLockup";
import type { AppShellUser } from "./AppShell";
import type { DbRole } from "../types";

const RESERVED = ["admin", "dashboard", "login", "super-admin", "task", "api", "claim-org", "auth", "create-organisation", "join"];
// Public / non-organisation routes that must not be interpreted as orgSlug.
// (Otherwise /imprint -> orgSlug="imprint" would lead to links like /imprint/dashboard.)
const LEGAL_RESERVED = ["imprint", "privacy", "terms", "invite", "onboarding", "avv"];

function useOrgSlug(): string | null {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const segments = pathname.split("/").filter(Boolean);
  const orgFromPath =
    segments.length >= 1 && !RESERVED.includes(segments[0]) && !LEGAL_RESERVED.includes(segments[0]) ? segments[0] : null;
  const orgFromQuery = searchParams?.get("org")?.trim() || null;
  return orgFromPath || orgFromQuery;
}

export default function AppHeader({ user, onMenuOpen }: { user: AppShellUser; onMenuOpen?: () => void }) {
  const pathname = usePathname() ?? "";
  const orgSlug = useOrgSlug();
  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgRole, setOrgRole] = useState<DbRole | null>(null);

  useEffect(() => {
    if (!orgSlug) {
      setOrgName(null);
      setOrgRole(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/org-settings?slug=${encodeURIComponent(orgSlug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (typeof data.name === "string" && data.name.trim()) setOrgName(data.name.trim());
        setOrgRole((data.role as DbRole | undefined) ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [orgSlug]);

  // Hide header on landing, auth, claim and create-organisation
  if (pathname === "/" || pathname.startsWith("/auth") || pathname.startsWith("/claim-org") || pathname.startsWith("/create-organisation") || pathname.startsWith("/join")) return null;

  const logoutReturnTo = pathname.startsWith("/super-admin")
    ? "/login?redirectTo=/super-admin"
    : orgSlug ? `/${orgSlug}/login` : "/login";

  return (
    <header className="mb-6 flex items-center justify-between bg-transparent" role="banner">
      <div className="flex items-center gap-3">
        {onMenuOpen && (
          <button
            type="button"
            onClick={onMenuOpen}
            className="lg:hidden rounded-[var(--radius-input)] p-2 text-text-muted transition-colors hover:bg-bg-secondary hover:text-text-primary dark:hover:bg-bg-primary/8 dark:hover:text-text-primary"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0">
          <OrgFlowLogoLockup
            href={
              orgSlug
                ? orgRole === "viewer"
                  ? `/${orgSlug}/overview`
                  : `/${orgSlug}/dashboard`
                : "/"
            }
            size="sm"
            className="max-w-full"
          />
          {orgName ? (
            <p className="mt-1 truncate pl-[2.75rem] text-xs font-normal text-text-muted">
              {orgName}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        {user && !pathname.startsWith("/auth") && !pathname.startsWith("/claim-org") && (
          <NotificationBell orgSlug={orgSlug} />
        )}
        {!user && orgSlug && (
          <FullPageLink
            href={`/${orgSlug}/login`}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-input)] px-3 py-1.5 text-sm font-medium text-text-secondary transition hover:bg-bg-secondary dark:hover:bg-bg-primary/8"
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

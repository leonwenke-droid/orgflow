"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import AppHeader from "./AppHeader";
import MobileNav from "./layout/MobileNav";

export type AppShellUser =
  | {
      id: string;
      email?: string | null;
      user_metadata?: Record<string, unknown> | null;
    }
  | null;

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
  // Public / non-organisation routes (kein Org-Slug)
  "imprint",
  "privacy",
  "terms",
  "invite",
  "onboarding",
  "avv",
];

function useOrgSlug(): string | null {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const segments = pathname.split("/").filter(Boolean);
  const orgFromPath =
    segments.length >= 1 && !RESERVED.includes(segments[0]) ? segments[0] : null;
  const orgFromQuery = searchParams?.get("org")?.trim() || null;
  return orgFromPath || orgFromQuery;
}

function AppShellInner({
  user,
  children,
}: {
  user: AppShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const orgSlug = useOrgSlug();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (pathname === "/") {
    return <>{children}</>;
  }

  const showSidebar = !!(orgSlug && user);

  return (
    <>
      <Sidebar
        user={user}
        orgSlug={orgSlug}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className={`min-w-0 flex-1 ${showSidebar ? "lg:pl-60" : ""}`}>
        <AppHeader user={user} onMenuOpen={() => setMobileOpen(true)} />
        {children}
      </div>
      <MobileNav user={user} orgSlug={orgSlug} />
    </>
  );
}

export default function AppShell({
  user,
  children,
}: {
  user: AppShellUser;
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <AppShellInner user={user}>{children}</AppShellInner>
    </Suspense>
  );
}

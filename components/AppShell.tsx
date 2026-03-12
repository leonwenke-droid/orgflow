"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { Menu } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import Sidebar from "./Sidebar";
import AppHeader from "./AppHeader";

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
  user: User | null;
  children: React.ReactNode;
}) {
  const orgSlug = useOrgSlug();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <Sidebar
        user={user}
        orgSlug={orgSlug}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="min-w-0 flex-1 lg:pl-56">
        <AppHeader user={user} onMenuOpen={() => setMobileOpen(true)} />
        {children}
      </div>
    </>
  );
}

export default function AppShell({
  user,
  children,
}: {
  user: User | null;
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <AppShellInner user={user}>{children}</AppShellInner>
    </Suspense>
  );
}

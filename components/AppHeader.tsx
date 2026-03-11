"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Suspense } from "react";
import type { User } from "@supabase/supabase-js";
import HeaderNav from "./HeaderNav";

const RESERVED = ["admin", "dashboard", "login", "super-admin", "task", "api", "claim-org", "auth", "create-organisation", "join"];

function useOrgSlug(): string | null {
  const pathname = usePathname() ?? "";
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length >= 1 && !RESERVED.includes(segments[0])) return segments[0];
  return null;
}

export default function AppHeader({ user }: { user: User | null }) {
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

  return (
    <header className="mb-6 flex items-center justify-between" role="banner">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">
          {orgName ? `OrgFlow – ${orgName}` : "OrgFlow"}
        </h1>
        <p className="text-xs text-gray-500">
          Tasks, shifts & finances.
        </p>
      </div>
        <Suspense fallback={<div className="h-9 w-32 animate-pulse rounded-lg bg-gray-200" />}>
        <HeaderNav user={user} />
      </Suspense>
    </header>
  );
}

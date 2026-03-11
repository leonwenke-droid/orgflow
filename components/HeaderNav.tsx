"use client";

import { usePathname, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import FullPageLink from "./FullPageLink";
import LogoutButton from "./LogoutButton";
import { LayoutDashboard, Settings2 } from "lucide-react";

/**
 * Navigation: Dashboard and Admin only in organisation context.
 * orgSlug from path (e.g. /my-org/dashboard) or from ?org= (e.g. /admin/tasks?org=my-org).
 */
export default function HeaderNav({ user }: { user: User | null }) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const segments = pathname.split("/").filter(Boolean);
  const reserved = ["admin", "dashboard", "login", "super-admin", "task", "api", "claim-org", "auth"];
  const orgFromPath = segments.length >= 1 && !reserved.includes(segments[0]) ? segments[0] : null;
  const orgFromQuery = searchParams?.get("org")?.trim() || null;
  const orgSlug = orgFromPath || orgFromQuery;

  const logoutReturnTo =
    pathname.startsWith("/super-admin")
      ? "/login?redirectTo=/super-admin"
      : orgSlug
        ? `/${orgSlug}/dashboard`
        : "/";

  return (
    <nav className="flex items-center gap-2">
      {user && orgSlug && (
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-1 py-0.5">
          <FullPageLink
            href={`/${orgSlug}/dashboard`}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden />
            Dashboard
          </FullPageLink>
          <FullPageLink
            href={`/${orgSlug}/admin`}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
          >
            Admin
          </FullPageLink>
          <FullPageLink
            href={`/${orgSlug}/settings`}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
          >
            <Settings2 className="h-4 w-4" aria-hidden />
            Settings
          </FullPageLink>
        </div>
      )}
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
    </nav>
  );
}

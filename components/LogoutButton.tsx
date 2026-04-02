"use client";

import { useState } from "react";

/**
 * Nach Logout wird zu returnTo weitergeleitet.
 * - Aus Super-Admin: returnTo="/login?redirectTo=/super-admin"
 * - Aus Jahrgang (Admin/Dashboard): returnTo="/{orgSlug}/login"
 * - Sonst: returnTo="/login"
 */
export default function LogoutButton({ returnTo = "/login" }: { returnTo?: string }) {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error(e);
    } finally {
      const target = returnTo?.trim() || "/";
      window.location.href = target.startsWith("/") ? target : `/${target}`;
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="rounded-md border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-border-default hover:bg-bg-secondary hover:text-text-primary disabled:opacity-50 dark:border-border-default dark:text-text-muted dark:hover:border-border-default dark:hover:bg-bg-primary dark:hover:text-text-primary"
    >
      {loading ? "Logging out…" : "Log out"}
    </button>
  );
}


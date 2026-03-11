"use client";

import { useState } from "react";

/**
 * Nach Logout wird zu returnTo weitergeleitet.
 * - Aus Super-Admin: returnTo="/login?redirectTo=/super-admin"
 * - Aus Jahrgang (Admin/Dashboard): returnTo="/{orgSlug}/dashboard"
 * - Sonst: returnTo="/"
 */
export default function LogoutButton({ returnTo = "/" }: { returnTo?: string }) {
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
      className="rounded-md border border-cyan-500/20 px-3 py-1.5 text-xs font-medium text-cyan-400 transition hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-200 disabled:opacity-50"
    >
      {loading ? "Abmelden…" : "Abmelden"}
    </button>
  );
}


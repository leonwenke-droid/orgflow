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
      className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-gray-400 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
    >
      {loading ? "Abmelden…" : "Abmelden"}
    </button>
  );
}


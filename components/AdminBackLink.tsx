"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminBackLink() {
  const pathname = usePathname();
  if (!pathname || pathname === "/admin") return null;

  return (
    <div className="mb-4">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 rounded px-2 py-1.5 -mx-2 -my-1.5 transition-colors"
        aria-label="Zurück zum Admin-Board"
      >
        <span aria-hidden>←</span>
        <span>Admin-Board</span>
      </Link>
    </div>
  );
}

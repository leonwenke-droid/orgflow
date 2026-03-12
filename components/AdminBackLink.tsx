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
        className="-mx-2 -my-1.5 inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-sm text-gray-600 transition-colors hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
        aria-label="Zurück zum Admin-Board"
      >
        <span aria-hidden>←</span>
        <span>Admin-Board</span>
      </Link>
    </div>
  );
}

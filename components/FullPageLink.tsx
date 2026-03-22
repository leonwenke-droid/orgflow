"use client";

import type { ReactNode } from "react";

type Props = {
  href: string;
  children: ReactNode;
  className?: string;
};

/**
 * Link that forces a full page load on click (window.location).
 * Prefer `next/link` with `prefetch` (see Sidebar) for normal navigation.
 * Use FullPageLink only when client-side navigation fails in specific browsers.
 * Middle-click / open in new tab still uses the normal href.
 */
export default function FullPageLink({ href, children, className }: Props) {
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        // Middle-click, Ctrl/Cmd-click → normal behavior (new tab)
        if (e.ctrlKey || e.metaKey || e.button === 1) return;
        e.preventDefault();
        window.location.href = href;
      }}
    >
      {children}
    </a>
  );
}

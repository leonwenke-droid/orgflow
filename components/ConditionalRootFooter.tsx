"use client";

import { usePathname } from "next/navigation";
import FooterLinks from "./FooterLinks";

/** Global app footer; hidden on the marketing homepage (it ships its own footer). */
export default function ConditionalRootFooter() {
  const pathname = usePathname() ?? "";
  if (pathname === "/") return null;

  return (
    <footer className="mt-8 border-t border-border-subtle pt-4 text-xs text-text-secondary dark:border-border-default dark:text-text-muted">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a
          href="https://lyniqmedia.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-secondary transition-colors hover:text-text-secondary dark:hover:text-text-secondary"
        >
          powered by LYNIQ Media
        </a>
        <FooterLinks />
      </div>
    </footer>
  );
}

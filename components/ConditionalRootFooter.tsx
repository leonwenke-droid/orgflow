"use client";

import { usePathname } from "next/navigation";
import FooterLinks from "./FooterLinks";

/** Global app footer; hidden on the marketing homepage (it ships its own footer). */
export default function ConditionalRootFooter() {
  const pathname = usePathname() ?? "";
  if (pathname === "/") return null;

  return (
    <footer className="mt-8 border-t border-gray-200 pt-4 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a
          href="https://lyniqmedia.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 transition-colors hover:text-gray-700 dark:hover:text-gray-300"
        >
          powered by LYNIQ Media
        </a>
        <FooterLinks />
      </div>
    </footer>
  );
}

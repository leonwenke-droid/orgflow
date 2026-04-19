"use client";

import { usePathname } from "next/navigation";
import { useLocale } from "./LocaleProvider";
import { isNonOrgTopSegment } from "../lib/orgRouteSegments";

export default function FooterLinks() {
  const pathname = usePathname() ?? "";
  const { locale } = useLocale();
  const segments = pathname.split("/").filter(Boolean);
  const orgSlug =
    segments.length >= 1 && !isNonOrgTopSegment(segments[0]) ? segments[0] : null;
  const base = orgSlug ? `/${orgSlug}` : "";

  return (
    <div className="flex flex-wrap gap-4">
      <a className="hover:text-text-secondary dark:hover:text-text-secondary" href={base ? `${base}/privacy` : "/privacy"}>
        {locale === "de" ? "Datenschutz" : "Privacy"}
      </a>
      <a className="hover:text-text-secondary dark:hover:text-text-secondary" href={base ? `${base}/terms` : "/terms"}>
        {locale === "de" ? "Nutzungsbedingungen" : "Terms"}
      </a>
      <a className="hover:text-text-secondary dark:hover:text-text-secondary" href={base ? `${base}/imprint` : "/imprint"}>
        {locale === "de" ? "Impressum" : "Imprint"}
      </a>
    </div>
  );
}

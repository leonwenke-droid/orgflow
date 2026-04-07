"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2 } from "lucide-react";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";

/**
 * Link to /dashboard when the user has more than one organisation (same login / email).
 */
export default function SidebarMultiOrgLink({
  linkClassName,
  onClose
}: {
  linkClassName: (href: string) => string;
  onClose?: () => void;
}) {
  const { locale } = useLocale();
  const pathname = usePathname() ?? "";
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/org-memberships")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { count?: number } | null) => {
        if (!cancelled && data && typeof data.count === "number" && data.count > 1) {
          setShow(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  const href = "/dashboard";
  const active = pathname === "/dashboard";

  return (
    <div className="mt-4 border-t border-border-subtle pt-4 dark:border-border-subtle">
      <div className="section-label px-3">{t("account.all_orgs_heading", locale)}</div>
      <div className="mt-2">
        <Link href={href} prefetch className={linkClassName(href)} onClick={onClose} aria-current={active ? "page" : undefined}>
          <Building2 className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          <span className="min-w-0 truncate">{t("nav.all_my_orgs", locale)}</span>
        </Link>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLocale } from "../LocaleProvider";
import { t } from "../../lib/i18n";

export default function ShiftPlanViewToggle() {
  const { locale } = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "calendar" ? "calendar" : "list";

  const hrefFor = (next: "list" | "calendar") => {
    const p = new URLSearchParams(searchParams.toString());
    if (next === "list") p.delete("view");
    else p.set("view", "calendar");
    const qs = p.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  return (
    <div className="flex flex-wrap gap-1">
      <Link
        href={hrefFor("list")}
        className="ui-pill text-xs"
        aria-current={view === "list" ? "page" : undefined}
      >
        {t("shifts.view_list", locale)}
      </Link>
      <Link
        href={hrefFor("calendar")}
        className="ui-pill text-xs"
        aria-current={view === "calendar" ? "page" : undefined}
      >
        {t("shifts.view_calendar", locale)}
      </Link>
    </div>
  );
}

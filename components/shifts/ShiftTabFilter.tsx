"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import { useLocale } from "../LocaleProvider";
import type { ShiftTimeFilter } from "../../lib/shiftTimeFilter";

const TABS = [
  { key: "all" as const, de: "Alle", en: "All" },
  { key: "today" as const, de: "Heute", en: "Today" },
  { key: "upcoming" as const, de: "Kommend", en: "Upcoming" },
  { key: "past" as const, de: "Vergangen", en: "Past" },
] as const;

export default function ShiftTabFilter() {
  const { locale } = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const current = (searchParams.get("time") as ShiftTimeFilter) || "all";

  const setTab = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "all") {
        params.delete("time");
      } else {
        params.set("time", tab);
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [searchParams, router, pathname]
  );

  return (
    <div className="flex flex-wrap gap-1">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setTab(tab.key)}
          className="ui-pill text-xs"
          aria-current={current === tab.key ? "page" : undefined}
        >
          {locale === "de" ? tab.de : tab.en}
        </button>
      ))}
    </div>
  );
}

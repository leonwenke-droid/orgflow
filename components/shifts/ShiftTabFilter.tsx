"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import { useLocale } from "../LocaleProvider";

const TABS = [
  { key: "all", de: "Alle", en: "All" },
  { key: "today", de: "Heute", en: "Today" },
  { key: "upcoming", de: "Kommend", en: "Upcoming" },
  { key: "past", de: "Vergangen", en: "Past" },
] as const;

export type ShiftTimeFilter = (typeof TABS)[number]["key"];

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

export function filterShiftsByTime<
  T extends { date?: string | null }
>(shifts: T[], filter: ShiftTimeFilter, todayStr: string): T[] {
  if (filter === "all") return shifts;
  if (filter === "today") return shifts.filter((s) => s.date === todayStr);
  if (filter === "upcoming") return shifts.filter((s) => (s.date ?? "") > todayStr);
  if (filter === "past") return shifts.filter((s) => (s.date ?? "") < todayStr);
  return shifts;
}

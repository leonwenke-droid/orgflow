"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLocale } from "../LocaleProvider";
import { t } from "../../lib/i18n";
import { SHIFTS_CONSOLE_TAB_ORDER, type ShiftsConsoleTabId } from "../../lib/shiftsConsoleTabs";

export type { ShiftsConsoleTabId };

export default function ShiftsConsoleTabs({ active }: { active: ShiftsConsoleTabId }) {
  const { locale } = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hrefFor = (id: ShiftsConsoleTabId) => {
    const p = new URLSearchParams(searchParams.toString());
    if (id === "admin") {
      p.delete("tab");
    } else {
      p.set("tab", id);
    }
    if (id !== "cal") {
      p.delete("view");
    }
    const qs = p.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const label = (id: ShiftsConsoleTabId) =>
    t(
      (
        {
          admin: "shifts.console_tab_admin",
          cal: "shifts.console_tab_cal",
          member: "shifts.console_tab_member",
          attend: "shifts.console_tab_attend",
          qr: "shifts.console_tab_qr",
          stats: "shifts.console_tab_stats"
        } as const
      )[id],
      locale
    );

  return (
    <div className="tab-shell mb-5">
      <nav className="tabs" aria-label="Shifts console">
        {SHIFTS_CONSOLE_TAB_ORDER.map((id) => (
          <Link
            key={id}
            href={hrefFor(id)}
            className="tab"
            aria-current={active === id ? "page" : undefined}
            prefetch={false}
          >
            {label(id)}
          </Link>
        ))}
      </nav>
    </div>
  );
}

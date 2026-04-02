"use client";

import { useCallback, useMemo, useState } from "react";
import type { Locale } from "../../lib/i18n";
import { t } from "../../lib/i18n";
import { formatShiftSlot, type AppLocale } from "../../lib/formatDate";

type ShiftRow = {
  id: string;
  event_name?: string | null;
  date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  required_slots?: number | null;
  auto_assign?: boolean | null;
  claimable?: boolean | null;
  shift_assignments?: { id: string; user_id?: string | null; replacement_user_id?: string | null }[] | null;
};

type Filter = "all" | "free" | "mine";

function dotColor(free: number) {
  if (free <= 0) return "bg-[#A32D2D]";
  if (free === 1) return "bg-[#854F0B]";
  return "bg-[#3B6D11]";
}

function formatDateSeparator(ymd: string, locale: Locale) {
  const s = String(ymd ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || "–";
  const [y, m, d] = s.split("-").map(Number);
  const loc = locale === "en" ? "en-GB" : "de-DE";
  return new Intl.DateTimeFormat(loc, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(y, m - 1, d)
  );
}

export default function MemberShiftsClient({
  orgSlug,
  locale,
  canClaim,
  myProfileId,
  organizationId,
  shifts,
  claimShiftAction,
}: {
  orgSlug: string;
  locale: Locale;
  canClaim: boolean;
  myProfileId: string;
  organizationId: string;
  shifts: ShiftRow[];
  claimShiftAction: (formData: FormData) => Promise<void>;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const fl = locale as AppLocale;

  const isAssignedToMe = useCallback(
    (s: ShiftRow) =>
      (s.shift_assignments ?? []).some((a) => a.user_id === myProfileId || a.replacement_user_id === myProfileId),
    [myProfileId]
  );

  const filtered = useMemo(() => {
    const list = [...shifts];
    if (filter === "mine") return list.filter(isAssignedToMe);
    if (filter === "free") {
      return list.filter((s) => {
        const required = Number(s.required_slots ?? 1) || 1;
        const taken = (s.shift_assignments ?? []).length;
        const free = Math.max(0, required - taken);
        return free > 0;
      });
    }
    return list;
  }, [shifts, filter, isAssignedToMe]);

  const grouped = useMemo(() => {
    const map = new Map<string, ShiftRow[]>();
    for (const s of filtered) {
      const key = String(s.date ?? "").slice(0, 10) || "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <header>
        <h1 className="page-title">{t("dashboard.shifts", locale)}</h1>
        <p className="page-sub">
          {locale === "en" ? "Sign up for open shifts" : "Trag dich in freie Schichten ein"}
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="ui-pill text-xs" aria-current={filter === "all" ? "page" : undefined} onClick={() => setFilter("all")}>
          {t("finance.filter_all", locale)}
        </button>
        <button type="button" className="ui-pill text-xs" aria-current={filter === "free" ? "page" : undefined} onClick={() => setFilter("free")}>
          {t("dashboard.filter_free_shifts", locale)}
        </button>
        <button type="button" className="ui-pill text-xs" aria-current={filter === "mine" ? "page" : undefined} onClick={() => setFilter("mine")}>
          {t("dashboard.my_assigned_shifts", locale)}
        </button>
      </div>

      <section className="card">
        <div className="p-4">
          {grouped.length === 0 ? (
            <p className="text-sm text-text-muted">{t("empty.member.shifts", locale)}</p>
          ) : (
            <div className="space-y-4">
              {grouped.map(([dateKey, rows]) => (
                <div key={dateKey}>
                  <div className="rounded-[var(--radius-input)] border border-border-subtle bg-bg-secondary px-3 py-2 text-sm font-medium text-text-secondary dark:border-border-subtle dark:bg-bg-primary/8">
                    {dateKey === "—" ? "—" : formatDateSeparator(dateKey, locale)}
                  </div>
                  <ul className="divide-y divide-border-subtle dark:divide-border-subtle">
                    {rows.map((s) => {
                      const required = Number(s.required_slots ?? 1) || 1;
                      const taken = (s.shift_assignments ?? []).length;
                      const free = Math.max(0, required - taken);
                      const assigned = isAssignedToMe(s);
                      const showButton =
                        canClaim && !assigned && free > 0 && s.auto_assign !== true && s.claimable !== false;
                      const isFull = free <= 0;
                      return (
                        <li key={s.id} className={`py-3 ${isFull ? "opacity-60" : ""}`}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${dotColor(free)}`} aria-hidden />
                                <span className="text-xs text-text-muted">
                                  {free} {locale === "en" ? "free" : "frei"}
                                </span>
                                <span className="font-medium text-text-primary">{s.event_name || t("dashboard.shifts", locale)}</span>
                                {assigned ? <span className="tag tag-blue">{t("shifts.you_are_signed_up", locale)}</span> : null}
                              </div>
                              <div className="mt-1 text-xs text-text-muted">
                                {s.date ? formatShiftSlot(String(s.date), s.start_time, s.end_time, fl) : "–"}
                                {s.location ? ` · ${s.location}` : ""}
                                {` · ${Math.max(0, free)} von ${required} ${locale === "en" ? "free" : "frei"}`}
                                {isFull ? ` · ${locale === "en" ? "Full" : "Belegt"}` : ""}
                              </div>
                            </div>
                            {showButton ? (
                              <form action={claimShiftAction}>
                                <input type="hidden" name="orgSlug" value={orgSlug} />
                                <input type="hidden" name="organization_id" value={organizationId} />
                                <input type="hidden" name="shiftId" value={s.id} />
                                <button type="submit" className="btn-primary">
                                  {t("shifts.claim", locale)}
                                </button>
                              </form>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}


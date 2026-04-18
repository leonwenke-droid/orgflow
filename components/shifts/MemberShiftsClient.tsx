"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Locale } from "../../lib/i18n";
import { t } from "../../lib/i18n";
import { formatShiftSlot, type AppLocale } from "../../lib/formatDate";
import { effectiveAssignmentKind, memberMaySelfCheckIn } from "../../lib/shiftAssignmentKind";
import { isShiftQrWindowActive } from "../../lib/shiftQr";
import { MemberQrCode } from "./MemberQrCode";
import SubmitButtonWithSpinner from "../SubmitButtonWithSpinner";

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
  assignment_kind?: string | null;
  attendance_mode?: string | null;
  qr_token?: string | null;
  qr_valid_from?: string | null;
  qr_valid_until?: string | null;
  shift_assignments?: {
    id: string;
    user_id?: string | null;
    replacement_user_id?: string | null;
    status?: string | null;
    swap_offered?: boolean | null;
  }[] | null;
};

type Filter = "all" | "free" | "mine";

type SwapOfferRow = {
  assignmentId: string;
  originalOwnerId: string;
  originalOwnerName?: string;
  shift: ShiftRow;
};

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

function startOfWeekMonday(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function shiftWeekStartMs(ymd: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  return startOfWeekMonday(new Date(y, m - 1, d)).getTime();
}

export default function MemberShiftsClient({
  orgSlug,
  locale,
  canClaim,
  myProfileId,
  memberDisplayName,
  organizationId,
  shifts,
  claimShiftAction,
  requestShiftTransferAction,
  claimShiftSwapAction,
  pendingTransferAssignmentIds = [],
  swapOffers = [],
  embeddedInAdminConsole = false,
  claimShiftNotice,
}: {
  orgSlug: string;
  locale: Locale;
  canClaim: boolean;
  myProfileId: string;
  memberDisplayName: string;
  organizationId: string;
  shifts: ShiftRow[];
  claimShiftAction: (formData: FormData) => Promise<void>;
  requestShiftTransferAction?: (formData: FormData) => Promise<void>;
  claimShiftSwapAction?: (formData: FormData) => Promise<void>;
  /** assignment IDs where a transfer request is pending approval */
  pendingTransferAssignmentIds?: string[];
  /** offered swaps that can be claimed */
  swapOffers?: SwapOfferRow[];
  /** Schichtplanung admin console: compact layout, prototype filter-pills */
  embeddedInAdminConsole?: boolean;
  /** Set after server redirect from failed self-signup (query `claimShift`) */
  claimShiftNotice?: "unavailable" | "error";
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [qrFor, setQrFor] = useState<{ assignmentId: string; title: string; qrValue: string } | null>(null);
  const [origin, setOrigin] = useState("");
  const fl = locale as AppLocale;

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const isAssignedToMe = useCallback(
    (s: ShiftRow) =>
      (s.shift_assignments ?? []).some((a) => a.user_id === myProfileId || a.replacement_user_id === myProfileId),
    [myProfileId]
  );

  const pendingSet = useMemo(() => new Set(pendingTransferAssignmentIds), [pendingTransferAssignmentIds]);

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

  const byWeek = useMemo(() => {
    if (!embeddedInAdminConsole) return null;
    const today = new Date();
    const thisMonday = startOfWeekMonday(today);
    const nextMonday = new Date(thisMonday);
    nextMonday.setDate(nextMonday.getDate() + 7);
    const t0 = thisMonday.getTime();
    const t1 = nextMonday.getTime();

    const thisWeek: ShiftRow[] = [];
    const nextWeek: ShiftRow[] = [];
    const later: ShiftRow[] = [];

    for (const s of filtered) {
      const ymd = String(s.date ?? "").slice(0, 10);
      const wk = shiftWeekStartMs(ymd);
      if (wk === null) {
        later.push(s);
        continue;
      }
      if (wk === t0) thisWeek.push(s);
      else if (wk === t1) nextWeek.push(s);
      else later.push(s);
    }

    const sortFn = (a: ShiftRow, b: ShiftRow) => {
      const da = String(a.date ?? "").slice(0, 10);
      const db = String(b.date ?? "").slice(0, 10);
      if (da !== db) return da.localeCompare(db);
      return String(a.start_time ?? "").localeCompare(String(b.start_time ?? ""));
    };
    thisWeek.sort(sortFn);
    nextWeek.sort(sortFn);
    later.sort(sortFn);
    return { thisWeek, nextWeek, later };
  }, [filtered, embeddedInAdminConsole]);

  function renderShiftRow(s: ShiftRow, layout: "embedded" | "list") {
    const required = Number(s.required_slots ?? 1) || 1;
    const taken = (s.shift_assignments ?? []).length;
    const free = Math.max(0, required - taken);
    const assigned = isAssignedToMe(s);
    // Members may sign up as long as the shift has free slots, regardless of assignment kind.
    // Auto/rotation can be executed later and should only fill remaining slots.
    const showButton = canClaim && !assigned && free > 0;
    const myAssignment = (s.shift_assignments ?? []).find(
      (a) => a.user_id === myProfileId || a.replacement_user_id === myProfileId
    );
    const myOwnPrimary =
      myAssignment?.user_id === myProfileId &&
      myAssignment?.replacement_user_id == null;
    const transferPending = myAssignment?.id ? pendingSet.has(String(myAssignment.id)) : false;
    const alreadyOffered = Boolean(myAssignment?.swap_offered);
    const checkinUrl =
      origin && orgSlug && myAssignment?.id
        ? `${origin}/checkin?org=${encodeURIComponent(orgSlug)}&assignmentId=${encodeURIComponent(myAssignment.id)}&auto=1`
        : "";
    const tokenUrl =
      origin && orgSlug && s.qr_token && isShiftQrWindowActive(s.qr_valid_from, s.qr_valid_until)
        ? `${origin}/checkin?org=${encodeURIComponent(orgSlug)}&qr_token=${encodeURIComponent(s.qr_token)}&auto=1`
        : "";
    const qrValue = tokenUrl || checkinUrl;
    const showQr = Boolean(assigned && qrValue && memberMaySelfCheckIn(s.attendance_mode));
    const showQrDayHint =
      assigned &&
      memberMaySelfCheckIn(s.attendance_mode) &&
      Boolean(s.qr_token) &&
      !isShiftQrWindowActive(s.qr_valid_from, s.qr_valid_until);
    const isFull = free <= 0;
    const dotClass = free <= 0 ? "dr" : free === 1 ? "da" : "dg";
    const freeLine = isFull
      ? t("shifts.member_shift_full_label", locale)
      : t("shifts.member_free_count", locale).replace("{count}", String(free));

    if (layout === "embedded") {
      return (
        <div key={s.id} className={`row ${isFull ? "opacity-60" : ""}`}>
          <div className="avail">
            <span className={`dot ${dotClass}`} aria-hidden />
            <span>{freeLine}</span>
          </div>
          <div className="rm">
            <div className="rt flex flex-wrap items-center gap-2">
              <span>{s.event_name || t("dashboard.shifts", locale)}</span>
              {assigned ? (
                <span className="tag tb">{t("shifts.you_are_signed_up", locale)}</span>
              ) : null}
            </div>
            <div className="rmt">
              {s.date ? formatShiftSlot(String(s.date), s.start_time, s.end_time, fl) : "–"}
              {s.location ? ` · ${s.location}` : ""}
              {` · ${t("shifts.member_slots_detail", locale).replace("{free}", String(Math.max(0, free))).replace("{required}", String(required))}`}
              {isFull ? ` · ${t("shifts.member_shift_full_label", locale)}` : ""}
            </div>
            {showQrDayHint ? (
              <div className="rmt" style={{ color: "var(--sp-accent)" }}>
                {t("shifts.member_qr_day_available", locale)}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {showButton ? (
              <form action={claimShiftAction}>
                <input type="hidden" name="orgSlug" value={orgSlug} />
                <input type="hidden" name="organization_id" value={organizationId} />
                <input type="hidden" name="shiftId" value={s.id} />
                <SubmitButtonWithSpinner className="btn btnp" loadingLabel="…">
                  {t("shifts.claim", locale)}
                </SubmitButtonWithSpinner>
              </form>
            ) : null}
            {showQr ? (
              <button
                type="button"
                className="btn"
                onClick={() =>
                  setQrFor({
                    assignmentId: myAssignment!.id,
                    title: s.event_name || t("dashboard.shifts", locale),
                    qrValue
                  })
                }
              >
                {t("shifts.show_checkin_qr", locale)}
              </button>
            ) : null}
            {requestShiftTransferAction && myOwnPrimary ? (
              transferPending ? (
                <span className="tag ta">{t("transfers.badge_pending", locale)}</span>
              ) : alreadyOffered ? null : (
                <form action={requestShiftTransferAction}>
                  <input type="hidden" name="orgSlug" value={orgSlug} />
                  <input type="hidden" name="assignmentId" value={myAssignment?.id ?? ""} />
                  <SubmitButtonWithSpinner className="btn" loadingLabel="…">
                    {t("tasks.offer_short", locale)}
                  </SubmitButtonWithSpinner>
                </form>
              )
            ) : null}
          </div>
        </div>
      );
    }

    return (
      <li key={s.id} className={`py-3 ${isFull ? "opacity-60" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${dotColor(free)}`} aria-hidden />
              <span className="text-xs text-text-muted">{freeLine}</span>
              <span className="font-medium text-text-primary">{s.event_name || t("dashboard.shifts", locale)}</span>
              {assigned ? <span className="tag tag-blue">{t("shifts.you_are_signed_up", locale)}</span> : null}
            </div>
            <div className="mt-1 text-xs text-text-muted">
              {s.date ? formatShiftSlot(String(s.date), s.start_time, s.end_time, fl) : "–"}
              {s.location ? ` · ${s.location}` : ""}
              {` · ${t("shifts.member_slots_detail", locale).replace("{free}", String(Math.max(0, free))).replace("{required}", String(required))}`}
              {isFull ? ` · ${t("shifts.member_shift_full_label", locale)}` : ""}
            </div>
            {showQrDayHint ? (
              <div className="mt-1 text-xs" style={{ color: "var(--sp-accent)" }}>
                {t("shifts.member_qr_day_available", locale)}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {showButton ? (
              <form action={claimShiftAction}>
                <input type="hidden" name="orgSlug" value={orgSlug} />
                <input type="hidden" name="organization_id" value={organizationId} />
                <input type="hidden" name="shiftId" value={s.id} />
                <SubmitButtonWithSpinner className="btn-primary" loadingLabel="…">
                  {t("shifts.claim", locale)}
                </SubmitButtonWithSpinner>
              </form>
            ) : null}
            {showQr ? (
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() =>
                  setQrFor({
                    assignmentId: myAssignment!.id,
                    title: s.event_name || t("dashboard.shifts", locale),
                    qrValue
                  })
                }
              >
                {t("shifts.show_checkin_qr", locale)}
              </button>
            ) : null}
            {requestShiftTransferAction && myOwnPrimary ? (
              transferPending ? (
                <span className="tag tag-amber">{t("transfers.badge_pending", locale)}</span>
              ) : alreadyOffered ? null : (
                <form action={requestShiftTransferAction} className="inline">
                  <input type="hidden" name="orgSlug" value={orgSlug} />
                  <input type="hidden" name="assignmentId" value={myAssignment?.id ?? ""} />
                  <SubmitButtonWithSpinner className="btn-secondary text-xs" loadingLabel="…">
                    {t("tasks.offer_short", locale)}
                  </SubmitButtonWithSpinner>
                </form>
              )
            ) : null}
          </div>
        </div>
      </li>
    );
  }

  return (
    <div
      className={
        embeddedInAdminConsole
          ? "mx-auto max-w-5xl space-y-5 pb-2 pt-0"
          : "mx-auto max-w-5xl space-y-5 p-6"
      }
    >
      {swapOffers.length > 0 && claimShiftSwapAction ? (
        <section className="card">
          <div className="p-4">
            <div className="section-label">{t("shifts.swaps_section_title", locale)}</div>
            <ul className="divide-y divide-border-subtle dark:divide-border-subtle">
              {swapOffers.map((o) => {
                const s = o.shift as any;
                const title = s?.event_name || t("dashboard.shifts", locale);
                return (
                  <li key={o.assignmentId} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="tag tag-amber">{t("shifts.swap_offer_badge", locale)}</span>
                          <span className="font-medium text-text-primary">{title}</span>
                        </div>
                        <div className="mt-1 text-xs text-text-muted">
                          {s?.date ? formatShiftSlot(String(s.date), s.start_time, s.end_time, fl) : "–"}
                          {s?.location ? ` · ${s.location}` : ""}
                          {o.originalOwnerName ? ` · ${t("transfers.from", locale)}: ${o.originalOwnerName}` : ""}
                        </div>
                      </div>
                      <form action={claimShiftSwapAction} className="inline">
                        <input type="hidden" name="orgSlug" value={orgSlug} />
                        <input type="hidden" name="organization_id" value={organizationId} />
                        <input type="hidden" name="assignmentId" value={o.assignmentId} />
                        <SubmitButtonWithSpinner className="btn-primary text-xs" loadingLabel="…">
                          {t("tasks.claim", locale)}
                        </SubmitButtonWithSpinner>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null}
      {!embeddedInAdminConsole ? (
        <header>
          <h1 className="page-title">{t("dashboard.shifts", locale)}</h1>
          <p className="page-sub">{t("shifts.member_page_intro", locale)}</p>
        </header>
      ) : null}

      {!embeddedInAdminConsole && claimShiftNotice ? (
        <div
          className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--bg-danger-subtle)] px-4 py-3 text-sm text-[var(--color-danger-text)]"
          role="alert"
        >
          {claimShiftNotice === "unavailable"
            ? t("shifts.claim_blocked_unavailable", locale)
            : t("dashboard.claim_shift_failed", locale)}
        </div>
      ) : null}

      <div className={embeddedInAdminConsole ? "filter-pills" : "flex flex-wrap gap-2"}>
        <button
          type="button"
          className={
            embeddedInAdminConsole
              ? filter === "all"
                ? "tag tb"
                : "tag tn"
              : "ui-pill text-xs"
          }
          aria-current={filter === "all" ? "page" : undefined}
          onClick={() => setFilter("all")}
        >
          {t("finance.filter_all", locale)}
        </button>
        <button
          type="button"
          className={
            embeddedInAdminConsole
              ? filter === "free"
                ? "tag tb"
                : "tag tn"
              : "ui-pill text-xs"
          }
          aria-current={filter === "free" ? "page" : undefined}
          onClick={() => setFilter("free")}
        >
          {t("dashboard.filter_free_shifts", locale)}
        </button>
        <button
          type="button"
          className={
            embeddedInAdminConsole
              ? filter === "mine"
                ? "tag tb"
                : "tag tn"
              : "ui-pill text-xs"
          }
          aria-current={filter === "mine" ? "page" : undefined}
          onClick={() => setFilter("mine")}
        >
          {t("dashboard.my_assigned_shifts", locale)}
        </button>
      </div>

      <section className="card">
        {embeddedInAdminConsole && byWeek ? (
          byWeek.thisWeek.length + byWeek.nextWeek.length + byWeek.later.length === 0 ? (
            <div className="p-4">
              <p className="text-sm" style={{ color: "var(--sp-text2)" }}>
                {t("empty.member.shifts", locale)}
              </p>
            </div>
          ) : (
            <>
              {byWeek.thisWeek.length > 0 ? (
                <>
                  <div className="date-strip">{t("shifts.member_section_this_week", locale)}</div>
                  {byWeek.thisWeek.map((s) => renderShiftRow(s, "embedded"))}
                </>
              ) : null}
              {byWeek.nextWeek.length > 0 ? (
                <>
                  <div className="date-strip">{t("shifts.member_section_next_week", locale)}</div>
                  {byWeek.nextWeek.map((s) => renderShiftRow(s, "embedded"))}
                </>
              ) : null}
              {byWeek.later.length > 0 ? (
                <>
                  <div className="date-strip">{t("shifts.member_section_later", locale)}</div>
                  {byWeek.later.map((s) => renderShiftRow(s, "embedded"))}
                </>
              ) : null}
            </>
          )
        ) : grouped.length === 0 ? (
          <div className="p-4">
            <p className="text-sm text-text-muted">{t("empty.member.shifts", locale)}</p>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            {grouped.map(([dateKey, rows]) => (
              <div key={dateKey}>
                <div className="rounded-[var(--radius-input)] border border-border-subtle bg-bg-secondary px-3 py-2 text-sm font-medium text-text-secondary dark:border-border-subtle dark:bg-bg-primary/8">
                  {dateKey === "—" ? "—" : formatDateSeparator(dateKey, locale)}
                </div>
                <ul className="divide-y divide-border-subtle dark:divide-border-subtle">
                  {rows.map((s) => renderShiftRow(s, "list"))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {qrFor && origin && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t("shifts.show_checkin_qr", locale)}
          onClick={() => setQrFor(null)}
        >
          <div
            className="max-w-sm rounded-xl border border-border-subtle bg-bg-primary p-5 shadow-xl dark:border-border-default"
            onClick={(e) => e.stopPropagation()}
          >
            <MemberQrCode
              value={qrFor.qrValue}
              title={qrFor.title}
              memberName={memberDisplayName || t("shifts.you_are_signed_up", locale)}
            />
            <button type="button" className="btn-secondary mt-4 w-full text-xs" onClick={() => setQrFor(null)}>
              {t("common.close", locale)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


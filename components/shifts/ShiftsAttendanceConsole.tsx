"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "../LocaleProvider";
import { t } from "../../lib/i18n";
import AdminShiftQrScanner from "./AdminShiftQrScanner";
import ShiftAttendancePdfExport from "../ShiftAttendancePdfExport";
import type { ShiftForPdf } from "../ShiftAttendancePdfExport";

type Row = {
  id: string;
  user_id: string;
  status: string;
  checked_in_at?: string | null;
  check_in_method?: string | null;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
}

function shiftIsRunning(shift: ShiftForPdf): boolean {
  const d = String(shift.date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const start = String(shift.start_time ?? "00:00").slice(0, 5);
  const end = String(shift.end_time ?? "23:59").slice(0, 5);
  const startDt = new Date(`${d}T${start}:00`);
  const endDt = new Date(`${d}T${end}:00`);
  if (endDt < startDt) endDt.setDate(endDt.getDate() + 1);
  const now = new Date();
  return now >= startDt && now <= endDt;
}

export default function ShiftsAttendanceConsole({
  orgSlug,
  organizationId,
  organizationName,
  shifts,
  profileNames,
  profileRoles,
  markAssignmentAttended,
  markAssignmentNotAttended
}: {
  orgSlug: string;
  organizationId?: string;
  organizationName?: string;
  shifts: ShiftForPdf[];
  profileNames: Record<string, string>;
  profileRoles?: Record<string, string | null | undefined>;
  markAssignmentAttended: (assignmentId: string) => Promise<void>;
  markAssignmentNotAttended: (assignmentId: string, replacementUserId: string | null) => Promise<void>;
}) {
  const { locale } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const shiftIdFromUrl = searchParams.get("shiftId");
  const [selectedId, setSelectedId] = useState<string>(() => shifts[0]?.id ?? "");
  const [scanLogByShift, setScanLogByShift] = useState<Record<string, { name: string; time: string }[]>>({});
  const [qrOpen, setQrOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!shiftIdFromUrl || !shifts.some((s) => s.id === shiftIdFromUrl)) return;
    setSelectedId(shiftIdFromUrl);
  }, [shiftIdFromUrl, shifts]);

  const selected = useMemo(() => shifts.find((s) => s.id === selectedId) ?? shifts[0], [shifts, selectedId]);

  const assignments: Row[] = useMemo(() => (selected?.shift_assignments ?? []) as Row[], [selected]);

  const stats = useMemo(() => {
    const total = assignments.length;
    const present = assignments.filter((a) => !!a.checked_in_at || a.status === "erledigt").length;
    const pending = assignments.filter(
      (a) => !a.checked_in_at && a.status !== "erledigt" && a.status !== "abgesagt"
    ).length;
    const absent = assignments.filter((a) => a.status === "abgesagt").length;
    return { present, pending, absent, total };
  }, [assignments]);

  const pushScanLog = useCallback(
    (assignmentId?: string, shiftId?: string) => {
      const sid = (shiftId ?? selectedId ?? "").trim();
      if (!sid) return;
      const a =
        assignments.find((x) => x.id === assignmentId) ??
        (shiftId ? assignments[0] : undefined);
      const name = a ? profileNames[a.user_id] ?? "?" : "?";
      const time = new Date().toLocaleTimeString(locale === "de" ? "de-DE" : "en-GB", {
        hour: "2-digit",
        minute: "2-digit"
      });
      setScanLogByShift((prev) => {
        const existing = prev[sid] ?? [];
        const next = [{ name, time }, ...existing].slice(0, 8);
        return { ...prev, [sid]: next };
      });
      router.refresh();
    },
    [assignments, profileNames, locale, router, selectedId]
  );

  const runConfirm = (assignmentId: string) => {
    startTransition(async () => {
      await markAssignmentAttended(assignmentId);
      router.refresh();
    });
  };

  const runAbsent = (assignmentId: string) => {
    if (!window.confirm(t("shifts.attend_confirm_absent_warning", locale))) return;
    startTransition(async () => {
      await markAssignmentNotAttended(assignmentId, null);
      router.refresh();
    });
  };

  const metaLine = useMemo(() => {
    if (!selected?.date) return "—";
    const d = String(selected.date).slice(0, 10);
    const [y, m, day] = d.split("-").map(Number);
    const dateFmt = new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", {
      weekday: "short",
      day: "numeric",
      month: "numeric"
    }).format(new Date(y, m - 1, day));
    const st = String(selected.start_time ?? "").slice(0, 5);
    const en = String(selected.end_time ?? "").slice(0, 5);
    return `${dateFmt} · ${st}–${en}`;
  }, [selected, locale]);

  const methodLabel = (a: Row) => {
    if (!a.checked_in_at && a.status !== "erledigt") return "";
    const m = a.check_in_method;
    if (m === "manual") return t("shifts.attend_method_manual_label", locale);
    return t("shifts.attend_method_qr_label", locale);
  };

  if (!orgSlug) {
    return (
      <p className="text-sm" style={{ color: "var(--sc-text2)" }}>
        {t("shifts.console_org_pick_hint", locale)}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold" style={{ color: "var(--sc-text3)" }}>
          {t("shifts.console_select_shift", locale)}
        </label>
        <select
          className="sc-select min-w-[220px]"
          value={selected?.id ?? ""}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {shifts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.event_name || s.id.slice(0, 8)} · {s.date}
            </option>
          ))}
        </select>
      </div>

      {selected ? (
        <>
          <div className="page-title-row">
            <span className="att-title">
              {t("shifts.attend_page_title_prefix", locale)} — {selected.event_name || t("dashboard.shifts", locale)}
            </span>
            {shiftIsRunning(selected) ? (
              <span className="tag ta">{t("shifts.attend_badge_running", locale)}</span>
            ) : null}
            <span className="meta">{metaLine}</span>
          </div>

          <div className="g3 mb-4">
            <div className="stat">
              <div className="sl">{t("shifts.attend_stat_present", locale)}</div>
              <div className="sv" style={{ color: "var(--sp-success)" }}>
                {stats.present}
              </div>
              <div className="ss">
                {t("shifts.attend_stat_present_sub", locale).replace("{total}", String(stats.total))}
              </div>
            </div>
            <div className="stat">
              <div className="sl">{t("shifts.attend_stat_pending", locale)}</div>
              <div className="sv" style={{ color: "var(--sp-warn)" }}>
                {stats.pending}
              </div>
              <div className="ss">{t("shifts.attend_stat_pending_sub", locale)}</div>
            </div>
            <div className="stat">
              <div className="sl">{t("shifts.attend_stat_absent", locale)}</div>
              <div className="sv" style={{ color: "var(--sp-danger)" }}>
                {stats.absent}
              </div>
              <div className="ss">{t("shifts.attend_stat_absent_sub", locale)}</div>
            </div>
          </div>

          <div className="card">
            <div className="chd">
              <span>{t("shifts.console_attend_list", locale)}</span>
              <div className="fl ml" style={{ marginLeft: "auto", gap: 8 }}>
                <button type="button" className="btn btnp" onClick={() => setQrOpen(true)}>
                  {t("shifts.attend_qr_scanner_open", locale)}
                </button>
                <ShiftAttendancePdfExport
                  organizationId={organizationId ?? ""}
                  shifts={[selected]}
                  profileNames={profileNames}
                  profileRoles={profileRoles}
                  organizationName={organizationName}
                  organizationSlug={orgSlug || undefined}
                  buttonClassName="btn"
                />
              </div>
            </div>

            {assignments.map((a) => {
              const name = profileNames[a.user_id] ?? "?";
              const checked = !!(a.checked_in_at || a.status === "erledigt");
              const cancelled = a.status === "abgesagt";
              const pending = !checked && !cancelled;
              const timeLabel =
                a.checked_in_at &&
                new Date(a.checked_in_at).toLocaleTimeString(locale === "de" ? "de-DE" : "en-GB", {
                  hour: "2-digit",
                  minute: "2-digit"
                });
              const sub = checked
                ? `${timeLabel ?? "—"} · ${methodLabel(a)}`
                : cancelled
                  ? t("shifts.attend_status_cancelled_detail", locale)
                  : t("shifts.attend_pending_no_checkin", locale);

              return (
                <div key={a.id} className="mscan">
                  <div
                    className="mss"
                    style={{
                      background: checked
                        ? "var(--sp-success-dim)"
                        : cancelled
                          ? "var(--sp-danger-dim)"
                          : "var(--sp-warn-dim)"
                    }}
                  >
                    {checked ? (
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--sp-success)" strokeWidth="2.2">
                        <polyline points="3,8 7,12 13,4" />
                      </svg>
                    ) : cancelled ? (
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--sp-danger)" strokeWidth="2" strokeLinecap="round">
                        <line x1="4" y1="4" x2="12" y2="12" />
                        <line x1="12" y1="4" x2="4" y2="12" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--sp-warn)" strokeWidth="1.5" strokeLinecap="round">
                        <circle cx="8" cy="8" r="6.5" />
                        <line x1="8" y1="4.5" x2="8" y2="8.5" />
                      </svg>
                    )}
                  </div>
                  <div
                    className="av"
                    style={
                      checked
                        ? {
                            background: "var(--sp-success-dim)",
                            color: "var(--sp-success)",
                            borderColor: "rgba(61, 214, 140, 0.35)"
                          }
                        : cancelled
                          ? {
                              background: "var(--sp-danger-dim)",
                              color: "var(--sp-danger)",
                              borderColor: "rgba(240, 113, 120, 0.35)"
                            }
                          : {
                              background: "var(--sp-warn-dim)",
                              color: "var(--sp-warn)",
                              borderColor: "rgba(240, 180, 41, 0.35)"
                            }
                    }
                  >
                    {initials(name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--sp-text)" }}>{name}</div>
                    <div style={{ fontSize: 12, color: "var(--sp-text2)", marginTop: 2 }}>{sub}</div>
                  </div>
                  {pending ? (
                    <div className="fl" style={{ gap: 6 }}>
                      <button
                        type="button"
                        className="btn btng"
                        style={{ fontSize: 11, padding: "6px 12px" }}
                        disabled={isPending}
                        onClick={() => runConfirm(a.id)}
                      >
                        {t("shifts.attend_confirm_manual", locale)}
                      </button>
                      <button
                        type="button"
                        className="btn btnr"
                        style={{ fontSize: 11, padding: "6px 12px" }}
                        disabled={isPending}
                        onClick={() => runAbsent(a.id)}
                      >
                        {t("shifts.attend_mark_absent", locale)}
                      </button>
                    </div>
                  ) : checked ? (
                    <span className="tag tg">{t("shifts.attend_tag_present", locale)}</span>
                  ) : (
                    <span className="tag tr">{t("shifts.attend_tag_absent", locale)}</span>
                  )}
                </div>
              );
            })}
          </div>

          {qrOpen ? (
            <div className="mwrap" role="presentation" onClick={() => setQrOpen(false)}>
              <div
                className="modal"
                style={{ maxWidth: 400 }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="qr-scan-title"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mhd" id="qr-scan-title">
                  {t("shifts.attend_qr_scanner_modal_title", locale)}
                </div>
                <div className="mbd modal-scroll">
                  <AdminShiftQrScanner
                    defaultOrgSlug={orgSlug}
                    onCheckInSuccess={({ assignmentId, shiftId }) => {
                      pushScanLog(assignmentId, shiftId);
                      setQrOpen(false);
                    }}
                  />
                </div>
                <div className="mft">
                  <button type="button" className="btn" onClick={() => setQrOpen(false)}>
                    {t("common.close", locale)}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {(scanLogByShift[selectedId] ?? []).length > 0 ? (
            <div className="card">
              <div className="chd">{t("shifts.console_scan_log", locale)}</div>
              <div className="cbd">
                <ul className="space-y-1 text-xs" style={{ color: "var(--sp-text2)" }}>
                  {(scanLogByShift[selectedId] ?? []).map((e, i) => (
                    <li key={i}>
                      {e.name} · {e.time}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-sm" style={{ color: "var(--sc-text2)" }}>
          {t("shifts.console_no_shift", locale)}
        </p>
      )}
    </div>
  );
}

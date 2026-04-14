"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ShiftEditModal from "./ShiftEditModal";
import SubmitButtonWithSpinner from "./SubmitButtonWithSpinner";
import { useLocale } from "./LocaleProvider";
import { t, type Locale } from "../lib/i18n";
import { effectiveAssignmentKind, type ShiftAssignmentKind } from "../lib/shiftAssignmentKind";
import AssignmentKindHelpIcon from "./shifts/AssignmentKindHelpIcon";
import RotationAssignButton from "./shifts/RotationAssignButton";

type Member = { id: string; full_name: string; load_index?: number; responsibility_malus?: number };

type AssignmentRow = {
  id: string;
  status: string;
  user_id: string;
  replacement_user_id?: string | null;
};

type Props = {
  orgSlug: string;
  shifts: any[];
  profileNames: Map<string, string>;
  membersSortedByLoad: Member[];
  assignToShift: (shiftId: string, formData: FormData) => Promise<void>;
  deleteShift: (formData: FormData) => Promise<void>;
  updateShift: (shiftId: string, formData: FormData) => Promise<void>;
  updateEventGroup?: (shiftIds: string[], formData: FormData) => Promise<void>;
  removeAssignment: (assignmentId: string) => Promise<void>;
  replaceAssignment: (assignmentId: string, formData: FormData) => Promise<void>;
  previewRotationForShift?: (shiftId: string) => Promise<
    import("../types/rotation").PreviewRotationForShiftResult
  >;
  assignRotationFairOne?: (shiftId: string) => Promise<import("../types/rotation").AssignRotationFairOneResult>;
  /** Actions rechts neben Typ-Filter (z. B. Neue Schicht, PDF, Batch Auto-Zuteilung) */
  headerActions?: ReactNode;
  /** When false, filter and help copy hide engagement-based assignment types (org module off). */
  engagementEnabled?: boolean;
};

function timeStr(t: string | null | undefined): string {
  const s = String(t ?? "").trim();
  return s.slice(0, 5) || "–";
}

function formatDateStrip(dateYmd: string, locale: Locale): string {
  const s = String(dateYmd ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || "–";
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const loc = locale === "en" ? "en-GB" : "de-DE";
  return new Intl.DateTimeFormat(loc, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
}

function slotDotClass(taken: number, required: number): "dg" | "da" | "dr" {
  if (taken === 0) return "dr";
  const free = Math.max(0, required - taken);
  if (free === 1) return "da";
  return "dg";
}

function kindDotColor(kind: ShiftAssignmentKind): string {
  switch (kind) {
    case "self_signup":
      return "#5b9fff";
    case "auto_assign":
      return "var(--sp-warn)";
    case "rotation":
      return "var(--sp-success)";
    case "fixed":
      return "var(--sp-violet)";
    default:
      return "var(--sp-text3)";
  }
}

function buildSubline(
  s: any,
  assignments: AssignmentRow[],
  profileNames: Map<string, string>,
  locale: Locale
): string {
  const time = `${timeStr(s.start_time)}–${timeStr(s.end_time)}`;
  const loc = typeof s.location === "string" ? s.location.trim() : "";
  const kind = effectiveAssignmentKind(s);
  const names = assignments.map((a) => profileNames.get(a.user_id ?? "") ?? "").filter(Boolean);
  if (names.length === 0) {
    if (kind === "rotation") {
      return [time, loc, t("shifts.admin_subline_rotation", locale)].filter(Boolean).join(" · ");
    }
    return [time, loc, t("shifts.admin_subline_no_assignments", locale)].filter(Boolean).join(" · ");
  }
  const shown = names.slice(0, 2).join(", ");
  const rest = names.length - 2;
  const namePart = rest > 0 ? `${shown} +${rest}` : shown;
  return [time, loc, namePart].filter(Boolean).join(" · ");
}

const KIND_OPTIONS_FULL = ["all", "self_signup", "auto_assign", "rotation", "fixed"] as const;

export default function ShiftPlanTableWithEdit({
  orgSlug,
  shifts,
  profileNames,
  membersSortedByLoad,
  assignToShift,
  deleteShift,
  updateShift,
  updateEventGroup,
  removeAssignment,
  replaceAssignment,
  previewRotationForShift,
  assignRotationFairOne,
  headerActions,
  engagementEnabled = true
}: Props) {
  const { locale } = useLocale();
  const router = useRouter();
  const kindOptions = engagementEnabled ? KIND_OPTIONS_FULL : (["all", "self_signup", "fixed"] as const);
  const [kindFilter, setKindFilter] = useState<(typeof KIND_OPTIONS_FULL)[number]>("all");
  const [editingShifts, setEditingShifts] = useState<any[] | null>(null);

  useEffect(() => {
    if (!editingShifts?.length || !shifts?.length) return;
    const ids = editingShifts.map((s: any) => s.id);
    const updated = ids.map((id) => shifts.find((s: any) => s.id === id)).filter(Boolean);
    if (updated.length === ids.length) setEditingShifts(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shifts]);
  const [editingPersonsOnly, setEditingPersonsOnly] = useState(false);

  const visibleShifts = useMemo(() => {
    if (kindFilter === "all") return shifts;
    return (shifts as any[]).filter((s) => effectiveAssignmentKind(s) === kindFilter);
  }, [shifts, kindFilter]);

  useEffect(() => {
    if (engagementEnabled) return;
    if (kindFilter === "auto_assign" || kindFilter === "rotation") setKindFilter("all");
  }, [engagementEnabled, kindFilter]);

  const byDate = useMemo(() => {
    const acc: Record<string, any[]> = {};
    for (const s of visibleShifts as any[]) {
      const d = String(s.date ?? "").slice(0, 10) || "—";
      if (!acc[d]) acc[d] = [];
      acc[d].push(s);
    }
    return acc;
  }, [visibleShifts]);

  const dates = Object.keys(byDate).sort();

  const attendHref = (shiftId: string) => {
    const q = new URLSearchParams();
    if (orgSlug) q.set("org", orgSlug);
    q.set("tab", "attend");
    q.set("shiftId", shiftId);
    return `/admin/shifts?${q.toString()}`;
  };

  return (
    <>
      <div className={`chd${headerActions ? " chd-shift-manage" : ""}`}>
        <div className="chd-shift-manage-top">
          <span>{t("shifts.v2_manage_shifts_title", locale)}</span>
          <select
            className="sh-kind-select"
            value={kindFilter}
            aria-label={t("shifts.filter_assignment_kind", locale)}
            onChange={(e) => setKindFilter(e.target.value as (typeof KIND_OPTIONS_FULL)[number])}
          >
            {kindOptions.map((k) => (
              <option key={k} value={k}>
                {t(`shifts.assignment_kind_short_${k}` as "shifts.assignment_kind_short_all", locale)}
              </option>
            ))}
          </select>
        </div>
        {headerActions ? <div className="chd-shift-manage-actions">{headerActions}</div> : null}
      </div>

      {dates.length === 0 ? (
        <div className="cbd">
          <p className="text-sm" style={{ color: "var(--sp-text2)" }}>
            {t("empty.shifts", locale)}
          </p>
        </div>
      ) : (
        dates.map((dateStr) => {
          const dayShifts = [...(byDate[dateStr] ?? [])].sort((a, b) =>
            String(a.start_time ?? "").localeCompare(String(b.start_time ?? ""))
          );
          return (
            <div key={dateStr}>
              <div className="date-strip">{formatDateStrip(dateStr, locale)}</div>
              {dayShifts.map((s: any) => {
                const assignments = (s.shift_assignments ?? []) as AssignmentRow[];
                const required = Math.max(1, Number(s.required_slots ?? 1) || 1);
                const taken = assignments.length;
                const ratio = `${taken}/${required}`;
                const dot = slotDotClass(taken, required);
                const kind = effectiveAssignmentKind(s);
                const dotCol = kindDotColor(kind);
                const sub = buildSubline(s, assignments, profileNames, locale);
                const title = String(s.event_name ?? "").trim() || t("shifts.untitled_shift", locale);
                const showRotationOnly =
                  engagementEnabled &&
                  taken < required &&
                  kind === "rotation" &&
                  previewRotationForShift &&
                  assignRotationFairOne &&
                  required > 0;

                return (
                  <div key={s.id} className="row admin-shift-row">
                    <div className="avail">
                      <span className={`dot ${dot}`} aria-hidden />
                      <span>{ratio}</span>
                    </div>
                    <div className="rm">
                      <div className="fl" style={{ marginBottom: 2 }}>
                        <span className="rt">{title}</span>
                        <span className="type-badge inline-flex items-center gap-1">
                          <span className="tdot" style={{ background: dotCol }} />
                          {t(`shifts.assignment_kind_short_${kind}` as "shifts.assignment_kind_short_self_signup", locale)}
                          <AssignmentKindHelpIcon kind={kind} engagementBased={engagementEnabled} />
                        </span>
                      </div>
                      <div className="rmt">{sub}</div>
                    </div>
                    {showRotationOnly ? (
                      <div className="ml">
                        <RotationAssignButton
                          shiftId={s.id}
                          previewRotationForShift={previewRotationForShift}
                          assignRotationFairOne={assignRotationFairOne}
                        />
                      </div>
                    ) : (
                      <div className="fl ml">
                        <Link href={attendHref(s.id)} className="btn no-underline">
                          {t("shifts.attendance_page_link", locale)}
                        </Link>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => {
                            setEditingShifts([s]);
                            setEditingPersonsOnly(false);
                          }}
                        >
                          {t("common.edit", locale)}
                        </button>
                        <form
                          action={deleteShift}
                          className="inline"
                          onSubmit={(e) => {
                            if (!window.confirm(t("shifts.confirm_delete_shift", locale))) e.preventDefault();
                          }}
                        >
                          <input type="hidden" name="shiftId" value={s.id} />
                          <SubmitButtonWithSpinner
                            className="btn btnr px-2 py-1.5 text-xs"
                            title={t("common.remove", locale)}
                            loadingLabel="…"
                            aria-label={t("common.remove", locale)}
                          >
                            ✕
                          </SubmitButtonWithSpinner>
                        </form>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })
      )}

      {editingShifts != null && editingShifts.length > 0 && (
        <ShiftEditModal
          engagementEnabled={engagementEnabled}
          shift={{
            id: editingShifts[0].id,
            event_name: editingShifts[0].event_name ?? "",
            date: String(editingShifts[0].date ?? ""),
            start_time: String(editingShifts[0].start_time ?? ""),
            end_time: String(editingShifts[0].end_time ?? ""),
            location: editingShifts[0].location ?? null,
            notes: editingShifts[0].notes ?? null,
            assignment_kind: editingShifts[0].assignment_kind ?? null,
            attendance_mode: editingShifts[0].attendance_mode ?? null
          }}
          assignments={(editingShifts[0].shift_assignments ?? []).map((a: any) => ({
            id: a.id,
            user_id: a.user_id ?? "",
            status: a.status ?? "zugewiesen"
          }))}
          members={membersSortedByLoad.map((m) => ({
            id: m.id,
            full_name: m.full_name ?? ""
          }))}
          profileNames={profileNames}
          updateShift={updateShift}
          assignToShift={assignToShift}
          removeAssignment={removeAssignment}
          replaceAssignment={replaceAssignment}
          onClose={() => {
            setEditingShifts(null);
            setEditingPersonsOnly(false);
          }}
          onRefresh={router.refresh}
          personsOnly={editingPersonsOnly}
          allShiftsWithAssignments={
            editingShifts.length > 1 && !editingPersonsOnly && updateEventGroup
              ? editingShifts.map((s: any) => ({
                  shift: {
                    id: s.id,
                    event_name: s.event_name ?? "",
                    date: String(s.date ?? ""),
                    start_time: String(s.start_time ?? ""),
                    end_time: String(s.end_time ?? ""),
                    location: s.location ?? null,
                    notes: s.notes ?? null,
                    assignment_kind: s.assignment_kind ?? null,
                    attendance_mode: s.attendance_mode ?? null
                  },
                  assignments: (s.shift_assignments ?? []).map((a: any) => ({
                    id: a.id,
                    user_id: a.user_id ?? "",
                    status: a.status ?? "zugewiesen"
                  }))
                }))
              : undefined
          }
          updateEventGroup={updateEventGroup}
        />
      )}
    </>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import CalendarPicker from "./CalendarPicker";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";
import { getTodayDateString } from "../lib/dateFormat";
import AssignmentKindHelpIcon from "./shifts/AssignmentKindHelpIcon";

function SubmitButton({
  className = "btn-primary text-xs inline-flex items-center justify-center gap-2 min-w-[180px] min-h-[44px] sm:min-h-0 disabled:opacity-70 disabled:pointer-events-none touch-manipulation",
  labelKey = "shifts.submit"
}: {
  className?: string;
  labelKey?: string;
}) {
  const { pending } = useFormStatus();
  const { locale } = useLocale();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
    >
      {pending ? (
        <>
          <span
            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--sp-border-strong)] border-t-[var(--sp-text)]"
            aria-hidden
          />
          {t("shifts.creating", locale)}
        </>
      ) : (
        t(labelKey, locale)
      )}
    </button>
  );
}

type CreateShiftsAction = (
  prev: { error?: string; errorKey?: string; success?: boolean } | null,
  formData: FormData
) => Promise<{ error?: string; errorKey?: string; success?: boolean }>;

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Same slot counting as server `createShifts` (event type). */
function countShiftSlots(startMin: number, endMin: number, intervalMinutes: number): number {
  if (endMin <= startMin || intervalMinutes < 1) return 0;
  let n = 0;
  let slotStart = startMin;
  while (slotStart < endMin) {
    n++;
    slotStart = Math.min(slotStart + intervalMinutes, endMin);
  }
  return n;
}

export default function CreateShiftsForm({
  action,
  organizationId,
  events = [],
  variant = "default",
  onCancel,
  onSuccess,
  engagementEnabled = true
}: {
  action: CreateShiftsAction;
  organizationId?: string;
  events?: { id: string; name: string }[];
  variant?: "default" | "modal";
  onCancel?: () => void;
  /** Called after a successful create (e.g. close modal). */
  onSuccess?: () => void;
  /** When false, auto/rotation assignment modes are hidden (Engagement module off). */
  engagementEnabled?: boolean;
}) {
  const { locale } = useLocale();
  const router = useRouter();
  const [state, formAction] = useFormState(action, null);
  const [type, setType] = useState<"recurring" | "event">("recurring");
  const [assignmentKind, setAssignmentKind] = useState<
    "self_signup" | "auto_assign" | "rotation" | "fixed"
  >("self_signup");
  const [attendanceMode, setAttendanceMode] = useState<"qr" | "admin_only" | "none">("qr");

  useEffect(() => {
    if (engagementEnabled) return;
    if (assignmentKind === "auto_assign" || assignmentKind === "rotation") setAssignmentKind("self_signup");
  }, [engagementEnabled, assignmentKind]);

  const [modalStart, setModalStart] = useState("09:00");
  const [modalEnd, setModalEnd] = useState("12:00");
  /** `full` = one shift for the whole period; otherwise minutes per slot (server splits the range). */
  const [modalSlotInterval, setModalSlotInterval] = useState<string>("60");

  const modalSpanMinutes = useMemo(() => {
    const a = timeToMinutes(modalStart);
    const b = timeToMinutes(modalEnd);
    if (b > a) return b - a;
    return 0;
  }, [modalStart, modalEnd]);

  const modalIntervalMinutesHidden = useMemo(() => {
    if (modalSpanMinutes < 1) return 60;
    if (modalSlotInterval === "full") return modalSpanMinutes;
    const n = Number(modalSlotInterval);
    return Number.isFinite(n) && n >= 1 ? n : 60;
  }, [modalSpanMinutes, modalSlotInterval]);

  const modalSlotPreviewCount = useMemo(() => {
    if (modalSpanMinutes < 1) return 0;
    if (modalSlotInterval === "full") return 1;
    const iv = Number(modalSlotInterval);
    if (!Number.isFinite(iv) || iv < 1) return 0;
    return countShiftSlots(timeToMinutes(modalStart), timeToMinutes(modalEnd), iv);
  }, [modalSpanMinutes, modalSlotInterval, modalStart, modalEnd]);

  const errorMessage = state?.errorKey ? t(state.errorKey, locale) : state?.error;

  useEffect(() => {
    if (!state?.success || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const org = params.get("org");
    const event = params.get("event");
    const next = new URLSearchParams();
    if (org) next.set("org", org);
    if (event) next.set("event", event);
    next.set("success", "1");
    const qs = next.toString();
    router.replace(qs ? `/admin/shifts?${qs}` : "/admin/shifts?success=1");
    router.refresh();
    onSuccess?.();
  }, [state?.success, router, onSuccess]);

  if (variant === "modal") {
    return (
      <form action={formAction} className="new-shift-modal-form flex min-h-0 flex-1 flex-col">
        <input type="hidden" name="type" value="event" />
        <input type="hidden" name="interval_minutes" value={String(modalIntervalMinutesHidden)} />
        <input type="hidden" name="assignment_kind" value={assignmentKind} />
        <input type="hidden" name="attendance_mode" value={attendanceMode} />
        {organizationId && <input type="hidden" name="organization_id" value={organizationId} />}
        <div className="new-shift-modal-body sc-form-surface modal-scroll flex-1 overflow-y-auto px-5 py-4">
          {errorMessage && (
            <p className="mb-3 text-xs text-red-400">{errorMessage}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="new-shift-field-label" htmlFor="new-shift-title">
                {t("shifts.title", locale)}
              </label>
              <input
                id="new-shift-title"
                type="text"
                name="event_name"
                required
                placeholder={t("shifts.v2_placeholder_title", locale)}
                className="ui-input new-shift-input min-h-[44px] w-full p-2.5 text-sm sm:min-h-0 sm:p-2"
              />
            </div>
            <div className="space-y-1.5">
              <label className="new-shift-field-label" htmlFor="new-shift-location">
                {t("shifts.location", locale)}
              </label>
              <input
                id="new-shift-location"
                type="text"
                name="location"
                placeholder={t("shifts.v2_placeholder_location", locale)}
                className="ui-input new-shift-input min-h-[44px] w-full p-2.5 text-sm sm:min-h-0 sm:p-2"
              />
            </div>
            <div className="space-y-1.5">
              <label className="new-shift-field-label" htmlFor="new-shift-date">
                {t("shifts.date", locale)}
              </label>
              <input
                id="new-shift-date"
                type="date"
                name="date"
                required
                defaultValue={getTodayDateString()}
                className="ui-input new-shift-input min-h-[44px] w-full p-2.5 text-sm sm:min-h-0 sm:p-2"
              />
            </div>
            <div className="space-y-1.5">
              <label className="new-shift-field-label" htmlFor="new-shift-slots">
                {t("shifts.v2_people", locale)}
              </label>
              <input
                id="new-shift-slots"
                type="number"
                name="required_slots"
                min={1}
                max={99}
                defaultValue={4}
                required
                className="ui-input new-shift-input min-h-[44px] w-full p-2.5 text-sm sm:min-h-0 sm:p-2"
              />
            </div>
            <div className="space-y-1.5">
              <label className="new-shift-field-label" htmlFor="new-shift-start">
                {t("shifts.v2_begin", locale)}
              </label>
              <input
                id="new-shift-start"
                type="time"
                name="start_time"
                value={modalStart}
                onChange={(e) => setModalStart(e.target.value)}
                required
                className="ui-input new-shift-input min-h-[44px] w-full p-2.5 text-sm sm:min-h-0 sm:p-2"
              />
            </div>
            <div className="space-y-1.5">
              <label className="new-shift-field-label" htmlFor="new-shift-end">
                {t("shifts.v2_end", locale)}
              </label>
              <input
                id="new-shift-end"
                type="time"
                name="end_time"
                value={modalEnd}
                onChange={(e) => setModalEnd(e.target.value)}
                required
                className="ui-input new-shift-input min-h-[44px] w-full p-2.5 text-sm sm:min-h-0 sm:p-2"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="new-shift-field-label" htmlFor="new-shift-interval">
                {t("shifts.interval_label", locale)}
              </label>
              <p className="mb-1 text-[10px] text-[var(--sp-text2)]">{t("shifts.interval_hint", locale)}</p>
              <select
                id="new-shift-interval"
                value={modalSlotInterval}
                onChange={(e) => setModalSlotInterval(e.target.value)}
                className="ui-input new-shift-input min-h-[44px] w-full p-2.5 text-sm sm:min-h-0 sm:p-2"
              >
                <option value="full">{t("shifts.interval_full", locale)}</option>
                <option value="15">{t("shifts.interval_15", locale)}</option>
                <option value="30">{t("shifts.interval_30", locale)}</option>
                <option value="45">{t("shifts.interval_45", locale)}</option>
                <option value="60">{t("shifts.interval_60", locale)}</option>
                <option value="90">{t("shifts.interval_90", locale)}</option>
                <option value="120">{t("shifts.interval_120", locale)}</option>
                <option value="180">{t("shifts.interval_180", locale)}</option>
              </select>
              {modalSpanMinutes > 0 && modalSlotPreviewCount > 0 ? (
                <p className="mt-1 text-[11px] font-medium text-[var(--sp-text2)]">
                  {t("shifts.slots_preview", locale).replace("{n}", String(modalSlotPreviewCount))}
                </p>
              ) : modalSpanMinutes < 1 ? (
                <p className="mt-1 text-[11px] text-amber-600/90">
                  {locale === "de"
                    ? "Ende muss nach dem Start liegen (gleicher Tag)."
                    : "End time must be after start time (same day)."}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <span className="new-shift-section-label">{t("shifts.v2_assignment", locale)}</span>
            <div className="new-shift-pill-row" role="group" aria-label={t("shifts.v2_assignment", locale)}>
              {(
                engagementEnabled
                  ? ([
                      ["self_signup", "shifts.assignment_kind_label_self_signup", "dot-blue"],
                      ["auto_assign", "shifts.assignment_kind_label_auto_assign", "dot-amber"],
                      ["rotation", "shifts.assignment_kind_label_rotation", "dot-green"],
                      ["fixed", "shifts.assignment_kind_label_fixed", "dot-purple"]
                    ] as const)
                  : ([
                      ["self_signup", "shifts.assignment_kind_label_self_signup", "dot-blue"],
                      ["fixed", "shifts.assignment_kind_label_fixed", "dot-purple"]
                    ] as const)
              ).map(([value, key, dot]) => (
                <button
                  key={value}
                  type="button"
                  className="new-shift-pill"
                  data-active={assignmentKind === value ? "true" : "false"}
                  onClick={() => setAssignmentKind(value)}
                >
                  <span className={`new-shift-pill-dot ${dot}`} aria-hidden />
                  <span className="inline-flex items-center gap-1">
                    {t(key, locale)}
                    <AssignmentKindHelpIcon kind={value} size="md" engagementBased={engagementEnabled} />
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <span className="new-shift-section-label">{t("shifts.v2_attendance", locale)}</span>
            <div className="new-shift-pill-row" role="group" aria-label={t("shifts.v2_attendance", locale)}>
              {(
                [
                  ["qr", "shifts.attendance_mode_label_qr", "dot-blue"],
                  ["admin_only", "shifts.attendance_mode_label_admin_only", "dot-green"],
                  ["none", "shifts.attendance_mode_label_none", "dot-grey"]
                ] as const
              ).map(([value, key, dot]) => (
                <button
                  key={value}
                  type="button"
                  className="new-shift-pill"
                  data-active={attendanceMode === value ? "true" : "false"}
                  onClick={() => setAttendanceMode(value)}
                >
                  <span className={`new-shift-pill-dot ${dot}`} aria-hidden />
                  {t(key, locale)}
                </button>
              ))}
            </div>
          </div>

          <details className="new-shift-more mt-6 rounded-lg border border-[var(--sp-border)] bg-[var(--sp-surface2)]/40 p-3">
            <summary className="cursor-pointer text-xs font-medium text-[var(--sp-text2)]">
              {t("shifts.v2_more_options", locale)}
            </summary>
            <div className="mt-3 space-y-3">
              {events.length > 0 ? (
                <div className="space-y-1">
                  <label className="new-shift-field-label">{t("shifts.event_optional", locale)}</label>
                  <select
                    name="event_id"
                    className="ui-input new-shift-input min-h-[40px] w-full p-2 text-xs"
                  >
                    <option value="">{t("shifts.event_none", locale)}</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="space-y-1">
                <label className="new-shift-field-label">{t("shifts.info_for_team", locale)}</label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder={t("shifts.info_for_team_placeholder", locale)}
                  className="ui-input new-shift-input min-h-[52px] w-full resize-y p-2 text-xs"
                />
              </div>
            </div>
          </details>
        </div>
        <div className="mft">
          <button type="button" className="btn" onClick={onCancel}>
            {t("common.cancel", locale)}
          </button>
          <SubmitButton
            className="btnp inline-flex min-h-[40px] min-w-[140px] items-center justify-center gap-2 rounded-[var(--sp-radius-sm)] px-4 text-xs font-semibold disabled:pointer-events-none disabled:opacity-70"
            labelKey="shifts.v2_submit_create"
          />
        </div>
      </form>
    );
  }

  return (
    <form action={formAction} className="grid gap-3 sm:gap-2 md:grid-cols-2">
      {organizationId && <input type="hidden" name="organization_id" value={organizationId} />}
      {errorMessage && (
        <p className="text-xs text-red-600 dark:text-red-400 md:col-span-2">{errorMessage}</p>
      )}
      <div className="space-y-1">
        <span className="text-[11px] font-semibold text-text-secondary">{t("shifts.type_label", locale)}</span>
        <div className="flex flex-col gap-1 text-[11px] text-text-muted">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="type"
              value="recurring"
              checked={type === "recurring"}
              onChange={() => setType("recurring")}
              className="rounded border-[var(--border-strong)]"
            />
            {t("shifts.type_recurring", locale)}
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="type"
              value="event"
              checked={type === "event"}
              onChange={() => setType("event")}
              className="rounded border-[var(--border-strong)]"
            />
            {t("shifts.type_event", locale)}
          </label>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-text-secondary">{t("shifts.date", locale)}</label>
        <CalendarPicker name="date" required />
      </div>
      {events.length > 0 && (
        <div className="space-y-1 md:col-span-2">
          <label className="text-[11px] font-semibold text-text-secondary">{t("shifts.event_optional", locale)}</label>
          <select
            name="event_id"
            className="ui-input min-h-[44px] p-2.5 text-xs sm:min-h-0 sm:p-2"
          >
            <option value="">{t("shifts.event_none", locale)}</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="space-y-1 md:col-span-2">
        <label className="text-[11px] font-semibold text-text-secondary">
          {t("shifts.time_frame", locale)}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="time"
            name="start_time"
            defaultValue="09:00"
            required
            className="ui-input min-h-[44px] p-2.5 text-xs sm:min-h-0 sm:p-2"
          />
          <span className="text-xs text-text-muted">{t("shifts.until", locale)}</span>
          <input
            type="time"
            name="end_time"
            defaultValue="12:00"
            required
            className="ui-input min-h-[44px] p-2.5 text-xs sm:min-h-0 sm:p-2"
          />
        </div>
      </div>
      <div className="space-y-1 md:col-span-2">
        <label className="text-[11px] font-semibold text-text-secondary">{t("shifts.title", locale)}</label>
        <input
          type="text"
          name="event_name"
          placeholder={type === "recurring" ? t("shifts.placeholder_title_recurring", locale) : t("shifts.placeholder_title_event", locale)}
          className="ui-input min-h-[44px] p-2.5 text-xs sm:min-h-0 sm:p-2"
        />
        <p className="text-[10px] text-text-muted">
          {locale === "de" ? "Optional — wird automatisch aus Datum/Zeit generiert, falls leer." : "Optional — auto-generated from date/time if left blank."}
        </p>
      </div>
      {type === "event" && (
        <>
          <div className="space-y-1 md:col-span-2">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="add_setup_teardown"
                value="1"
                className="rounded border-[var(--border-strong)]"
              />
              <span className="text-[11px] font-semibold text-text-secondary">
                {t("shifts.add_setup_teardown", locale)}
              </span>
            </label>
            <p className="ml-6 text-[10px] text-text-muted">
              {t("shifts.setup_teardown_note", locale)}
            </p>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[11px] font-semibold text-text-secondary">
              {t("shifts.interval_label", locale)}
            </label>
            <p className="mb-1 text-[10px] text-text-muted">
              {t("shifts.interval_hint", locale)}
            </p>
            <select
              name="interval_minutes"
              className="ui-input min-h-[44px] p-2.5 text-xs sm:min-h-0 sm:p-2"
              defaultValue="120"
            >
              <option value="15">{t("shifts.interval_15", locale)}</option>
              <option value="30">{t("shifts.interval_30", locale)}</option>
              <option value="45">{t("shifts.interval_45", locale)}</option>
              <option value="60">{t("shifts.interval_60", locale)}</option>
              <option value="90">{t("shifts.interval_90", locale)}</option>
              <option value="120">{t("shifts.interval_120", locale)}</option>
              <option value="180">{t("shifts.interval_180", locale)}</option>
            </select>
          </div>
        </>
      )}
      <div className="space-y-1 md:col-span-2">
        <label className="text-[11px] font-semibold text-text-secondary">
          {t("shifts.required_persons", locale)}
        </label>
        <select
          name="required_slots"
          defaultValue={4}
          className="ui-input min-h-[44px] p-2.5 text-xs sm:min-h-0 sm:p-2"
        >
          {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1 md:col-span-2">
        <label className="text-[11px] font-semibold text-text-secondary">{t("shifts.location", locale)}</label>
        <input
          type="text"
          name="location"
          placeholder={t("shifts.location_placeholder", locale)}
          className="ui-input min-h-[44px] p-2.5 text-xs sm:min-h-0 sm:p-2"
        />
      </div>
      <div className="space-y-1 md:col-span-2">
        <label className="text-[11px] font-semibold text-text-secondary">
          {t("shifts.info_for_team", locale)}
        </label>
        <textarea
          name="notes"
          rows={3}
          placeholder={t("shifts.info_for_team_placeholder", locale)}
          className="ui-input min-h-[60px] resize-y p-2.5 text-xs sm:p-2"
        />
      </div>
      <div className="space-y-1 md:col-span-2">
        <span className="text-[11px] font-semibold text-text-secondary">{t("shifts.assignment_kind_field", locale)}</span>
        <div className="mt-1 flex flex-col gap-1.5 text-[11px] text-text-muted">
          {(
            engagementEnabled
              ? ([
                  ["self_signup", "shifts.assignment_kind_label_self_signup"],
                  ["auto_assign", "shifts.assignment_kind_label_auto_assign"],
                  ["rotation", "shifts.assignment_kind_label_rotation"],
                  ["fixed", "shifts.assignment_kind_label_fixed"]
                ] as const)
              : ([
                  ["self_signup", "shifts.assignment_kind_label_self_signup"],
                  ["fixed", "shifts.assignment_kind_label_fixed"]
                ] as const)
          ).map(([value, key]) => (
            <label key={value} className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="assignment_kind"
                value={value}
                checked={assignmentKind === value}
                onChange={() => setAssignmentKind(value)}
                className="rounded border-[var(--border-strong)]"
              />
              <span className="inline-flex items-center gap-1">
                {t(key, locale)}
                <AssignmentKindHelpIcon kind={value} engagementBased={engagementEnabled} />
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-1 md:col-span-2">
        <span className="text-[11px] font-semibold text-text-secondary">{t("shifts.attendance_mode_field", locale)}</span>
        <div className="mt-1 flex flex-col gap-1.5 text-[11px] text-text-muted">
          {(
            [
              ["qr", "shifts.attendance_mode_label_qr"],
              ["admin_only", "shifts.attendance_mode_label_admin_only"],
              ["none", "shifts.attendance_mode_label_none"]
            ] as const
          ).map(([value, key]) => (
            <label key={value} className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="attendance_mode"
                value={value}
                checked={attendanceMode === value}
                onChange={() => setAttendanceMode(value)}
                className="rounded border-[var(--border-strong)]"
              />
              {t(key, locale)}
            </label>
          ))}
        </div>
      </div>
      <div className="md:col-span-2 pt-1">
        <SubmitButton />
      </div>
    </form>
  );
}

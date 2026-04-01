"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import CalendarPicker from "./CalendarPicker";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";

function SubmitButton() {
  const { pending } = useFormStatus();
  const { locale } = useLocale();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary text-xs inline-flex items-center justify-center gap-2 min-w-[180px] min-h-[44px] sm:min-h-0 disabled:opacity-70 disabled:pointer-events-none touch-manipulation"
    >
      {pending ? (
        <>
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-300 border-t-transparent" aria-hidden />
          {t("shifts.creating", locale)}
        </>
      ) : (
        t("shifts.submit", locale)
      )}
    </button>
  );
}

type CreateShiftsAction = (
  prev: { error?: string; errorKey?: string; success?: boolean } | null,
  formData: FormData
) => Promise<{ error?: string; errorKey?: string; success?: boolean }>;

export default function CreateShiftsForm({
  action,
  organizationId,
  events = []
}: {
  action: CreateShiftsAction;
  organizationId?: string;
  events?: { id: string; name: string }[];
}) {
  const { locale } = useLocale();
  const router = useRouter();
  const [state, formAction] = useFormState(action, null);
  const [type, setType] = useState<"recurring" | "event">("recurring");
  const [assignmentMode, setAssignmentMode] = useState<"claim" | "auto">("claim");
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
  }, [state?.success, router]);

  return (
    <form action={formAction} className="grid gap-3 sm:gap-2 md:grid-cols-2">
      {organizationId && <input type="hidden" name="organization_id" value={organizationId} />}
      {errorMessage && (
        <p className="text-xs text-red-600 dark:text-red-400 md:col-span-2">{errorMessage}</p>
      )}
      <div className="space-y-1">
        <span className="text-[11px] font-semibold text-[var(--ink-2)] dark:text-white/70">{t("shifts.type_label", locale)}</span>
        <div className="flex flex-col gap-1 text-[11px] text-[var(--ink-3)] dark:text-white/55">
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
        <label className="text-[11px] font-semibold text-[var(--ink-2)] dark:text-white/70">{t("shifts.date", locale)}</label>
        <CalendarPicker name="date" required />
      </div>
      {events.length > 0 && (
        <div className="space-y-1 md:col-span-2">
          <label className="text-[11px] font-semibold text-[var(--ink-2)] dark:text-white/70">{t("shifts.event_optional", locale)}</label>
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
        <label className="text-[11px] font-semibold text-[var(--ink-2)] dark:text-white/70">
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
          <span className="text-xs text-[var(--ink-3)] dark:text-white/55">{t("shifts.until", locale)}</span>
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
        <label className="text-[11px] font-semibold text-[var(--ink-2)] dark:text-white/70">{t("shifts.title", locale)}</label>
        <input
          type="text"
          name="event_name"
          placeholder={type === "recurring" ? t("shifts.placeholder_title_recurring", locale) : t("shifts.placeholder_title_event", locale)}
          className="ui-input min-h-[44px] p-2.5 text-xs sm:min-h-0 sm:p-2"
        />
        <p className="text-[10px] text-[var(--ink-3)] dark:text-white/45">
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
              <span className="text-[11px] font-semibold text-[var(--ink-2)] dark:text-white/70">
                {t("shifts.add_setup_teardown", locale)}
              </span>
            </label>
            <p className="ml-6 text-[10px] text-[var(--ink-3)] dark:text-white/45">
              {t("shifts.setup_teardown_note", locale)}
            </p>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[11px] font-semibold text-[var(--ink-2)] dark:text-white/70">
              {t("shifts.interval_label", locale)}
            </label>
            <p className="mb-1 text-[10px] text-[var(--ink-3)] dark:text-white/45">
              {t("shifts.interval_hint", locale)}
            </p>
            <select
              name="interval_minutes"
              className="ui-input min-h-[44px] p-2.5 text-xs sm:min-h-0 sm:p-2"
              defaultValue="120"
            >
              <option value="30">{t("shifts.interval_30", locale)}</option>
              <option value="45">{t("shifts.interval_45", locale)}</option>
              <option value="60">{t("shifts.interval_60", locale)}</option>
              <option value="120">{t("shifts.interval_120", locale)}</option>
              <option value="180">{t("shifts.interval_180", locale)}</option>
            </select>
          </div>
        </>
      )}
      <div className="space-y-1 md:col-span-2">
        <label className="text-[11px] font-semibold text-[var(--ink-2)] dark:text-white/70">
          {t("shifts.required_persons", locale)}
        </label>
        <input
          type="number"
          name="required_slots"
          min={0}
          defaultValue={4}
          className="ui-input min-h-[44px] p-2.5 text-xs sm:min-h-0 sm:p-2"
        />
      </div>
      <div className="space-y-1 md:col-span-2">
        <label className="text-[11px] font-semibold text-[var(--ink-2)] dark:text-white/70">{t("shifts.location", locale)}</label>
        <input
          type="text"
          name="location"
          placeholder={t("shifts.location_placeholder", locale)}
          className="ui-input min-h-[44px] p-2.5 text-xs sm:min-h-0 sm:p-2"
        />
      </div>
      <div className="space-y-1 md:col-span-2">
        <label className="text-[11px] font-semibold text-[var(--ink-2)] dark:text-white/70">
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
        <span className="text-[11px] font-semibold text-[var(--ink-2)] dark:text-white/70">{t("shifts.assignment_mode", locale)}</span>
        <div className="mt-1 flex flex-col gap-1 text-[11px] text-[var(--ink-3)] dark:text-white/55">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="assignment_mode"
              value="claim"
              checked={assignmentMode === "claim"}
              onChange={() => setAssignmentMode("claim")}
              className="rounded border-[var(--border-strong)]"
            />
            {t("shifts.assignment_mode_claim", locale)}
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="assignment_mode"
              value="auto"
              checked={assignmentMode === "auto"}
              onChange={() => setAssignmentMode("auto")}
              className="rounded border-[var(--border-strong)]"
            />
            {t("shifts.assignment_mode_auto", locale)}
          </label>
        </div>
      </div>
      <div className="space-y-1 md:col-span-2">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="auto_assign" value="on" className="rounded border-[var(--border-strong)]" checked={assignmentMode === "auto"} readOnly />
          <span className="text-[11px] font-semibold text-[var(--ink-2)] dark:text-white/70">
            {t("shifts.auto_assign_label", locale)}
          </span>
        </label>
      </div>
      <div className="md:col-span-2 pt-1">
        <SubmitButton />
      </div>
    </form>
  );
}

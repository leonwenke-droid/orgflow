"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
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
  const [state, formAction] = useFormState(action, null);
  const [type, setType] = useState<"recurring" | "event">("recurring");
  const errorMessage = state?.errorKey ? t(state.errorKey, locale) : state?.error;

  useEffect(() => {
    if (state?.success) {
      const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
      const org = params.get("org");
      window.location.href = org ? `/admin/shifts?org=${encodeURIComponent(org)}` : "/admin/shifts";
    }
  }, [state?.success]);

  return (
    <form action={formAction} className="grid gap-3 sm:gap-2 md:grid-cols-2">
      {organizationId && <input type="hidden" name="organization_id" value={organizationId} />}
      {errorMessage && (
        <p className="text-xs text-red-600 dark:text-red-400 md:col-span-2">{errorMessage}</p>
      )}
      <div className="space-y-1">
        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{t("shifts.type_label", locale)}</span>
        <div className="flex flex-col gap-1 text-[11px] text-gray-600 dark:text-gray-400">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="type"
              value="recurring"
              checked={type === "recurring"}
              onChange={() => setType("recurring")}
              className="rounded border-gray-400"
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
              className="rounded border-gray-400"
            />
            {t("shifts.type_event", locale)}
          </label>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{t("shifts.date", locale)}</label>
        <CalendarPicker name="date" required />
      </div>
      {events.length > 0 && (
        <div className="space-y-1 md:col-span-2">
          <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{t("shifts.event_optional", locale)}</label>
          <select
            name="event_id"
            className="min-h-[44px] w-full rounded border border-gray-300 bg-white p-2.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 sm:min-h-0 sm:p-2"
          >
            <option value="">{t("shifts.event_none", locale)}</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="space-y-1 md:col-span-2">
        <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{t("shifts.title", locale)}</label>
        <input
          type="text"
          name="event_name"
          required
          placeholder={type === "recurring" ? t("shifts.placeholder_title_recurring", locale) : t("shifts.placeholder_title_event", locale)}
          className="min-h-[44px] w-full rounded border border-gray-300 bg-white p-2.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 sm:min-h-0 sm:p-2"
        />
      </div>
      {type === "event" && (
        <>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
              {t("shifts.time_frame", locale)}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="time"
                name="start_time"
                defaultValue="09:00"
                required={type === "event"}
                className="min-h-[44px] rounded border border-gray-300 bg-white p-2.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 sm:min-h-0 sm:p-2"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">{t("shifts.until", locale)}</span>
              <input
                type="time"
                name="end_time"
                defaultValue="12:00"
                required={type === "event"}
                className="min-h-[44px] rounded border border-gray-300 bg-white p-2.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 sm:min-h-0 sm:p-2"
              />
            </div>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="add_setup_teardown"
                value="1"
                className="rounded border-gray-400"
              />
              <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                {t("shifts.add_setup_teardown", locale)}
              </span>
            </label>
            <p className="ml-6 text-[10px] text-gray-500 dark:text-gray-400">
              {t("shifts.setup_teardown_note", locale)}
            </p>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
              {t("shifts.interval_label", locale)}
            </label>
            <p className="mb-1 text-[10px] text-gray-500 dark:text-gray-400">
              {t("shifts.interval_hint", locale)}
            </p>
            <select
              name="interval_minutes"
              className="min-h-[44px] w-full rounded border border-gray-300 bg-white p-2.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 sm:min-h-0 sm:p-2"
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
        <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
          {t("shifts.required_persons", locale)}
        </label>
        <input
          type="number"
          name="required_slots"
          min={0}
          defaultValue={4}
          className="min-h-[44px] w-full rounded border border-gray-300 bg-white p-2.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 sm:min-h-0 sm:p-2"
        />
      </div>
      <div className="space-y-1 md:col-span-2">
        <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{t("shifts.location", locale)}</label>
        <input
          type="text"
          name="location"
          placeholder={t("shifts.location_placeholder", locale)}
          className="min-h-[44px] w-full rounded border border-gray-300 bg-white p-2.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 sm:min-h-0 sm:p-2"
        />
      </div>
      <div className="space-y-1 md:col-span-2">
        <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
          {t("shifts.info_for_team", locale)}
        </label>
        <textarea
          name="notes"
          rows={3}
          placeholder={t("shifts.info_for_team_placeholder", locale)}
          className="min-h-[60px] w-full resize-y rounded border border-gray-300 bg-white p-2.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 sm:p-2"
        />
      </div>
      <div className="md:col-span-2 pt-1">
        <SubmitButton />
      </div>
    </form>
  );
}

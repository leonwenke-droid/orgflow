"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import CalendarPicker from "./CalendarPicker";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary text-xs inline-flex items-center justify-center gap-2 min-w-[180px] min-h-[44px] sm:min-h-0 disabled:opacity-70 disabled:pointer-events-none touch-manipulation"
    >
      {pending ? (
        <>
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-300 border-t-transparent" aria-hidden />
          Creating shifts…
        </>
      ) : (
        "Create shift(s)"
      )}
    </button>
  );
}

type CreateShiftsAction = (
  prev: { error?: string; success?: boolean } | null,
  formData: FormData
) => Promise<{ error?: string; success?: boolean }>;

export default function CreateShiftsForm({
  action,
  organizationId
}: {
  action: CreateShiftsAction;
  organizationId?: string;
}) {
  const [state, formAction] = useFormState(action, null);
  const [type, setType] = useState<"pausenverkauf" | "event">("pausenverkauf");

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
      {state?.error && (
        <p className="text-xs text-red-600 md:col-span-2">{state.error}</p>
      )}
      <div className="space-y-1">
        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">Art</span>
        <div className="flex flex-col gap-1 text-[11px] text-gray-600 dark:text-gray-400">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="type"
              value="pausenverkauf"
              checked={type === "pausenverkauf"}
              onChange={() => setType("pausenverkauf")}
              className="rounded border-gray-400"
            />
            Break sales (1st & 2nd break)
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
            Event (custom time frame)
          </label>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">Date</label>
        <CalendarPicker name="date" required />
      </div>
      <div className="space-y-1 md:col-span-2">
        <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">Title</label>
        <input
          type="text"
          name="event_name"
          required
          placeholder={
            type === "pausenverkauf"
              ? "e.g. School day 12.02., break sales"
              : "e.g. Prom in the hall"
          }
          className="min-h-[44px] w-full rounded border border-gray-300 bg-white p-2.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 sm:min-h-0 sm:p-2"
        />
      </div>
      {type === "event" && (
        <>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
              Time frame
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="time"
                name="start_time"
                defaultValue="09:00"
                required={type === "event"}
                className="min-h-[44px] rounded border border-gray-300 bg-white p-2.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 sm:min-h-0 sm:p-2"
              />
              <span className="text-xs text-gray-500">bis</span>
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
                Add setup & teardown (30 min each)
              </span>
            </label>
            <p className="ml-6 text-[10px] text-gray-500 dark:text-gray-400">
              Erste Schicht startet 30 Min. früher (Aufbau), letzte endet 30 Min. später (Abbau). Zusätzliche Engagement-Punkte.
            </p>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
              Shift interval
            </label>
            <p className="mb-1 text-[10px] text-gray-500 dark:text-gray-400">
              Der Zeitraum wird in Abschnitte geteilt; pro Abschnitt können andere Personen eingeteilt werden.
            </p>
            <select
              name="interval_minutes"
              className="min-h-[44px] w-full rounded border border-gray-300 bg-white p-2.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 sm:min-h-0 sm:p-2"
              defaultValue="120"
            >
              <option value="30">30 Minuten</option>
              <option value="45">45 Minuten</option>
              <option value="60">1 Stunde</option>
              <option value="120">2 Stunden</option>
              <option value="180">3 Stunden</option>
            </select>
          </div>
        </>
      )}
      <div className="space-y-1 md:col-span-2">
        <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
          Required persons per shift
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
        <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">Location</label>
        <input
          type="text"
          name="location"
          placeholder="e.g. Canteen, Hall …"
          className="min-h-[44px] w-full rounded border border-gray-300 bg-white p-2.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 sm:min-h-0 sm:p-2"
        />
      </div>
      <div className="space-y-1 md:col-span-2">
        <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
          Info for cohort
        </label>
        <textarea
          name="notes"
          rows={3}
          placeholder="e.g. Who has the cash register, what is sold, important notes – shown on dashboard."
          className="min-h-[60px] w-full resize-y rounded border border-gray-300 bg-white p-2.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 sm:p-2"
        />
      </div>
      <div className="md:col-span-2 pt-1">
        <SubmitButton />
      </div>
    </form>
  );
}

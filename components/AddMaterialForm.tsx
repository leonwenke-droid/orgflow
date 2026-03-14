"use client";

import { useState, useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";

type Profile = { id: string; full_name: string };

const SIZE_OPTIONS = [
  { value: "small" as const, points: 5, labelKey: "resources.size_small" as const, examplesKey: "resources.examples_small" as const },
  { value: "medium" as const, points: 10, labelKey: "resources.size_medium" as const, examplesKey: "resources.examples_medium" as const },
  { value: "large" as const, points: 15, labelKey: "resources.size_large" as const, examplesKey: "resources.examples_large" as const },
];

type AddMaterialAction = (
  prev: { error?: string; success?: boolean } | null,
  formData: FormData
) => Promise<{ error?: string; success?: boolean }>;

function SubmitButton() {
  const { pending } = useFormStatus();
  const { locale } = useLocale();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary text-xs inline-flex items-center justify-center gap-2 min-w-[140px] disabled:opacity-70 disabled:pointer-events-none"
    >
      {pending ? (
        <>
          <span
            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-300 border-t-transparent"
            aria-hidden
          />
          {t("resources.recording", locale)}
        </>
      ) : (
        t("resources.record", locale)
      )}
    </button>
  );
}

export default function AddMaterialForm({
  profiles,
  addMaterialProcurement
}: {
  profiles: Profile[];
  addMaterialProcurement: AddMaterialAction;
}) {
  const { locale } = useLocale();
  const [state, formAction] = useFormState(addMaterialProcurement, null);
  const [personSlots, setPersonSlots] = useState([0]);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success && formRef.current) {
      formRef.current.reset();
      setPersonSlots([0]);
    }
  }, [state]);

  const addPerson = () => setPersonSlots([...personSlots, Date.now()]);
  const removePerson = (key: number) => setPersonSlots(personSlots.filter((k) => k !== key));

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state?.error && (
        <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-xs text-green-600 dark:text-green-400">{t("resources.recorded_success", locale)}</p>
      )}

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-600 dark:bg-gray-800">
        <span className="font-semibold text-gray-700 dark:text-gray-300">{t("resources.rating_title", locale)}</span>
        <table className="mt-1.5 w-full text-left">
          <thead>
            <tr className="text-gray-500 dark:text-gray-400">
              <th className="py-0.5">{t("resources.size", locale)}</th>
              <th className="py-0.5">{t("resources.points", locale)}</th>
              <th className="py-0.5">{t("resources.examples", locale)}</th>
            </tr>
          </thead>
          <tbody>
            {SIZE_OPTIONS.map((s) => (
              <tr key={s.value} className="border-t border-gray-100 dark:border-gray-700">
                <td className="py-1 font-medium dark:text-gray-200">{t(s.labelKey, locale)}</td>
                <td className="py-1 text-gray-700 dark:text-gray-300">+{s.points}</td>
                <td className="py-1 text-gray-500 dark:text-gray-400">{t(s.examplesKey, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
            {t("resources.persons", locale)}
          </label>
          {personSlots.map((key, idx) => (
            <div key={key} className="flex gap-2 items-center">
              <select
                name="user_ids"
                required={idx === 0}
                className="min-w-0 flex-1 rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">{t("resources.select", locale)}</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name ?? t("resources.no_name", locale)}
                  </option>
                ))}
              </select>
              {personSlots.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removePerson(key)}
                  className="shrink-0 rounded px-2 py-1.5 text-[10px] text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                >
                  {t("common.remove", locale)}
                </button>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            onClick={addPerson}
            className="text-xs text-blue-600 hover:underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            + {t("resources.add_person", locale)}
          </button>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
            {t("resources.event", locale)}
          </label>
          <input
            type="text"
            name="event_name"
            placeholder={t("resources.event_placeholder", locale)}
            required
            className="w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-400"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
            {t("resources.size_points", locale)}
          </label>
          <select
            name="size"
            required
            className="w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            {SIZE_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {t(s.labelKey, locale)} (+{s.points} {t("resources.points", locale)}) – {t(s.examplesKey, locale)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
            {t("resources.description", locale)}
          </label>
          <input
            type="text"
            name="description"
            placeholder={t("resources.placeholder_description", locale)}
            required
            className="w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-400"
          />
        </div>
      </div>
      <SubmitButton />
    </form>
  );
}

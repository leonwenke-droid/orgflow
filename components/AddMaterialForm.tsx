"use client";

import { useState, useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";

type Profile = { id: string; full_name: string };

const SIZE_OPTIONS = [
  { value: "small", label: "Small", points: 5, examples: "Cake, drinks, small decorations" },
  { value: "medium", label: "Medium", points: 10, examples: "Waffle iron, larger purchases, equipment" },
  { value: "large", label: "Large", points: 15, examples: "Complete event setup" }
] as const;

type AddMaterialAction = (
  prev: { error?: string; success?: boolean } | null,
  formData: FormData
) => Promise<{ error?: string; success?: boolean }>;

function SubmitButton() {
  const { pending } = useFormStatus();
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
          Erfassen …
        </>
      ) : (
        "Erfassen"
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
        <p className="text-xs text-red-600">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-xs text-green-600">Event- & Ressourcenmanagement erfasst.</p>
      )}

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs">
        <span className="font-semibold text-gray-700">Bewertung pro Person:</span>
        <table className="mt-1.5 w-full text-left">
          <thead>
            <tr className="text-gray-500">
              <th className="py-0.5">Größe</th>
              <th className="py-0.5">Punkte</th>
              <th className="py-0.5">Beispiele</th>
            </tr>
          </thead>
          <tbody>
            {SIZE_OPTIONS.map((s) => (
              <tr key={s.value} className="border-t border-gray-100">
                <td className="py-1 font-medium">{s.label}</td>
                <td className="py-1 text-gray-700">+{s.points}</td>
                <td className="py-1 text-gray-500">{s.examples}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <label className="block text-xs font-semibold text-gray-700">
            Person(en)
          </label>
          {personSlots.map((key, idx) => (
            <div key={key} className="flex gap-2 items-center">
              <select
                name="user_ids"
                required={idx === 0}
                className="min-w-0 flex-1 rounded border border-gray-300 bg-white p-2 text-sm text-gray-900"
              >
                <option value="">Auswählen …</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name ?? "(ohne Namen)"}
                  </option>
                ))}
              </select>
              {personSlots.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removePerson(key)}
                  className="shrink-0 rounded px-2 py-1.5 text-[10px] text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                >
                  Entfernen
                </button>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            onClick={addPerson}
            className="text-xs text-blue-600 hover:underline hover:text-blue-700"
          >
            + Weitere Person hinzufügen
          </button>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-gray-700">
            Event
          </label>
          <input
            type="text"
            name="event_name"
            placeholder="z.B. Halloween Party"
            required
            className="w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 placeholder:text-gray-400"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-gray-700">
            Größe & Punkte
          </label>
          <select
            name="size"
            required
            className="w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900"
          >
            {SIZE_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} (+{s.points} Punkte) – {s.examples}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="block text-xs font-semibold text-gray-700">
            Beschreibung
          </label>
          <input
            type="text"
            name="description"
            placeholder="z.B. Waffeleisen + Teig"
            required
            className="w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 placeholder:text-gray-400"
          />
        </div>
      </div>
      <SubmitButton />
    </form>
  );
}

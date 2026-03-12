"use client";

import SubmitButtonWithSpinner from "./SubmitButtonWithSpinner";

type Shift = {
  id: string;
  event_name: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  notes: string | null;
};

type Assignment = { id: string; user_id: string; status: string };

type Member = { id: string; full_name: string };

type ShiftWithAssignments = { shift: Shift; assignments: Assignment[] };

type Props = {
  shift: Shift;
  assignments: Assignment[];
  members: Member[];
  profileNames: Map<string, string>;
  updateShift: (shiftId: string, formData: FormData) => Promise<void>;
  assignToShift: (shiftId: string, formData: FormData) => Promise<void>;
  removeAssignment: (assignmentId: string) => Promise<void>;
  replaceAssignment: (assignmentId: string, formData: FormData) => Promise<void>;
  onClose: () => void;
  /** Nach Personenänderung aufrufen, damit Daten neu geladen werden (Modal bleibt offen) */
  onRefresh?: () => void;
  /** Nur Personen bearbeiten, keine Veranstaltungsdaten */
  personsOnly?: boolean;
  /** Alle Schichten der Veranstaltung (für Event-Bearbeitung: Personen aus allen Zeitslots) */
  allShiftsWithAssignments?: ShiftWithAssignments[];
  /** Beim Speichern alle Schichten mit Ort/Infos aktualisieren (erste voll) */
  updateEventGroup?: (shiftIds: string[], formData: FormData) => Promise<void>;
};

function timeForInput(t: string | null | undefined): string {
  const s = String(t ?? "").trim();
  return s.slice(0, 5) || "09:00";
}

function dateForInput(d: string | null | undefined): string {
  const s = String(d ?? "").trim();
  return s.slice(0, 10) || "";
}

/** Basis-Name ohne Schicht-Suffix (z. B. " – 1. Pause") für die Bearbeitung der gesamten Veranstaltung. */
function baseEventNameForEdit(eventName: string): string {
  return String(eventName ?? "").trim().replace(/\s*–\s*[12]\.\s*Pause$/i, "").trim() || String(eventName ?? "");
}

function timeStr(t: string | null | undefined): string {
  const s = String(t ?? "").trim();
  return s.slice(0, 5) || "–";
}

export default function ShiftEditModal({
  shift,
  assignments,
  members,
  profileNames,
  updateShift,
  assignToShift,
  removeAssignment,
  replaceAssignment,
  onClose,
  onRefresh,
  personsOnly = false,
  allShiftsWithAssignments,
  updateEventGroup
}: Props) {
  const isEventGroup = (allShiftsWithAssignments?.length ?? 0) > 1 && updateEventGroup;
  const totalAssignments = allShiftsWithAssignments?.reduce((sum, s) => sum + s.assignments.length, 0) ?? assignments.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={personsOnly ? "Personen zuweisen" : "Schicht bearbeiten"}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border-b-0 bg-white shadow-xl sm:max-h-[90vh] sm:rounded-xl sm:border-b border-gray-200 pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2.5 sm:py-2">
          <h3 className="text-xs font-semibold text-gray-900">
            {personsOnly ? "Persons" : isEventGroup ? "Edit event (all shifts)" : "Edit shift"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="-m-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded p-2 text-gray-600 hover:bg-blue-100 focus:outline-none touch-manipulation"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-3 overflow-y-auto space-y-3">
          {!personsOnly && (
          <form
            action={async (formData) => {
              if (isEventGroup && allShiftsWithAssignments) {
                await updateEventGroup(allShiftsWithAssignments.map((s) => s.shift.id), formData);
              } else {
                await updateShift(shift.id, formData);
              }
              onClose();
            }}
            className="space-y-2.5"
          >
            <div>
              <label className="text-[10px] font-semibold text-gray-700 block mb-0.5">Veranstaltung</label>
              <input
                type="text"
                name="event_name"
                required
                defaultValue={isEventGroup ? baseEventNameForEdit(shift.event_name) : shift.event_name}
                className="w-full rounded border border-gray-300 bg-white p-2.5 sm:p-2 text-xs min-h-[44px] sm:min-h-0"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-gray-700 block mb-0.5">Date</label>
                <input
                  type="date"
                  name="date"
                  required
                  defaultValue={dateForInput(shift.date)}
                  className="w-full rounded border border-gray-300 bg-white p-2.5 sm:p-2 text-xs min-h-[44px] sm:min-h-0"
                />
              </div>
              {!isEventGroup && (
              <div>
                <label className="text-[10px] font-semibold text-gray-700 block mb-0.5">Uhrzeit</label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    name="start_time"
                    required
                    defaultValue={timeForInput(shift.start_time)}
                    className="w-full rounded border border-gray-300 bg-white p-2.5 sm:p-2 text-xs min-h-[44px] sm:min-h-0"
                  />
                  <span className="text-gray-700/80 text-xs">–</span>
                  <input
                    type="time"
                    name="end_time"
                    required
                    defaultValue={timeForInput(shift.end_time)}
                    className="w-full rounded border border-gray-300 bg-white p-2.5 sm:p-2 text-xs min-h-[44px] sm:min-h-0"
                  />
                </div>
              </div>
              )}
            </div>
            {isEventGroup && (
              <>
                <input type="hidden" name="start_time" value={timeForInput(shift.start_time)} />
                <input type="hidden" name="end_time" value={timeForInput(shift.end_time)} />
              </>
            )}
            <div>
              <label className="text-[10px] font-semibold text-gray-700 block mb-0.5">Ort</label>
              <input
                type="text"
                name="location"
                defaultValue={shift.location ?? ""}
                placeholder="z.B. Mensa, Aula …"
                className="w-full rounded border border-gray-300 bg-white p-2.5 sm:p-2 text-xs min-h-[44px] sm:min-h-0"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-700 block mb-0.5">Infos</label>
              <textarea
                name="notes"
                rows={2}
                defaultValue={shift.notes ?? ""}
                placeholder="Info for the cohort …"
                className="w-full rounded border border-gray-300 bg-white p-2 text-xs resize-y"
              />
            </div>
            <SubmitButtonWithSpinner
              className="rounded bg-blue-600 px-3 py-2.5 text-[11px] text-white hover:bg-blue-700 sm:px-2.5 sm:py-1 disabled:opacity-70 min-h-[44px] sm:min-h-0 touch-manipulation"
              loadingLabel="…"
            >
              Speichern
            </SubmitButtonWithSpinner>
          </form>
          )}

          {isEventGroup ? (
            <details className="border-t border-gray-200 pt-2 group">
              <summary className="list-none cursor-pointer flex items-center gap-2 py-1.5 text-[11px] font-semibold text-gray-700 hover:text-gray-900">
                <span className="w-4 h-4 flex items-center justify-center text-gray-500 transition-transform group-open:rotate-90" aria-hidden>▶</span>
                Personen ({totalAssignments})
              </summary>
              <div className="pl-6 pt-2 space-y-4">
                {allShiftsWithAssignments!.map(({ shift: s, assignments: aList }) => (
                  <div key={s.id} className="rounded border border-gray-200 bg-gray-50 p-2 space-y-2">
                    <p className="text-[10px] font-semibold text-gray-700/90">{timeStr(s.start_time)}–{timeStr(s.end_time)}</p>
                    {aList.length === 0 ? (
                      <p className="text-[11px] text-gray-700/60">Keine zugewiesen.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {aList.map((a) => (
                          <li key={a.id} className="flex items-center gap-2 rounded border border-gray-200 bg-white px-2 py-1.5">
                            <span className="flex-1 text-[11px] text-gray-900 truncate">{profileNames.get(a.user_id ?? "") ?? "–"}</span>
                            <form action={async (fd: FormData) => { const uid = fd.get("user_id")?.toString(); if (uid) { await replaceAssignment(a.id, fd); onRefresh?.(); } }} className="flex items-center gap-1">
                              <select name="user_id" className="rounded border border-gray-300 bg-white px-1 py-0.5 text-[10px]">
                                <option value="">Ersetzen</option>
                                {members.filter((m) => m.id !== a.user_id).map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                              </select>
                              <SubmitButtonWithSpinner className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700" loadingLabel="…">Ersetzen</SubmitButtonWithSpinner>
                            </form>
                            <form action={async () => { await removeAssignment(a.id); onRefresh?.(); }}>
                              <SubmitButtonWithSpinner className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-600" title="Entfernen" loadingLabel="…">✕</SubmitButtonWithSpinner>
                            </form>
                          </li>
                        ))}
                      </ul>
                    )}
                    <form action={async (fd: FormData) => { const uid = fd.get("user_id")?.toString(); if (uid) { await assignToShift(s.id, fd); onRefresh?.(); } }} className="flex items-center gap-2">
                      <select name="user_id" className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] flex-1 min-w-0">
                        <option value="">Hinzufügen …</option>
                        {members.filter((m) => !aList.some((a) => a.user_id === m.id)).map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                      </select>
                      <SubmitButtonWithSpinner className="rounded shrink-0 bg-blue-100 px-2 py-0.5 text-[10px] text-blue-700" loadingLabel="…">+</SubmitButtonWithSpinner>
                    </form>
                  </div>
                ))}
              </div>
            </details>
          ) : (
          <div className={personsOnly ? "" : "border-t border-gray-200 pt-2"}>
            <p className="text-[10px] font-semibold text-gray-700 mb-1.5">Personen</p>
            {assignments.length === 0 ? (
              <p className="text-[11px] text-gray-700/70 mb-1.5">Keine zugewiesen.</p>
            ) : (
              <ul className="space-y-2">
                {assignments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-2"
                  >
                    <span className="flex-1 text-xs text-gray-900">
                      {profileNames.get(a.user_id ?? "") ?? "–"}
                    </span>
                    <form
                      action={async (formData) => {
                        const uid = formData.get("user_id")?.toString();
                        if (uid) { await replaceAssignment(a.id, formData); onRefresh?.(); }
                      }}
                      className="flex items-center gap-2"
                    >
                      <select
                        name="user_id"
                        className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px]"
                      >
                        <option value="">Ersetzen …</option>
                        {members
                          .filter((m) => m.id !== a.user_id)
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.full_name}
                            </option>
                          ))}
                      </select>
                      <SubmitButtonWithSpinner
                        className="inline-flex items-center gap-1.5 rounded bg-blue-100 px-2 py-1 text-[11px] text-blue-700 hover:bg-blue-200 disabled:opacity-70"
                        loadingLabel="…"
                      >
                        Ersetzen
                      </SubmitButtonWithSpinner>
                    </form>
                    <form action={async () => { await removeAssignment(a.id); onRefresh?.(); }}>
                      <SubmitButtonWithSpinner
                        className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-600 hover:bg-red-500/30 disabled:opacity-70"
                        title="Entfernen"
                        loadingLabel="…"
                      >
                        ✕
                      </SubmitButtonWithSpinner>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <form
              action={async (formData) => {
                const uid = formData.get("user_id")?.toString();
                if (uid) { await assignToShift(shift.id, formData); onRefresh?.(); }
              }}
              className="flex items-center gap-2 mt-2"
            >
              <select
                name="user_id"
                className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px]"
              >
                <option value="">Hinzufügen …</option>
                {members
                  .filter((m) => !assignments.some((a) => a.user_id === m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
              </select>
              <SubmitButtonWithSpinner
                className="inline-flex items-center gap-1.5 rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 hover:bg-blue-200 disabled:opacity-70"
                loadingLabel="Adding…"
              >
                Hinzufügen
              </SubmitButtonWithSpinner>
            </form>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

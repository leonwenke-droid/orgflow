"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ShiftEditModal from "./ShiftEditModal";
import SubmitButtonWithSpinner from "./SubmitButtonWithSpinner";
import { formatDateLabel } from "../lib/dateFormat";

type Member = { id: string; full_name: string; load_index?: number; responsibility_malus?: number };

type AssignmentRow = {
  id: string;
  status: string;
  user_id: string;
  replacement_user_id?: string | null;
};

type Props = {
  shifts: any[];
  todayStr: string;
  profileNames: Map<string, string>;
  membersSortedByLoad: Member[];
  assignToShift: (shiftId: string, formData: FormData) => Promise<void>;
  deleteShift: (formData: FormData) => Promise<void>;
  deleteEventShifts: (formData: FormData) => Promise<void>;
  updateShift: (shiftId: string, formData: FormData) => Promise<void>;
  updateEventGroup?: (shiftIds: string[], formData: FormData) => Promise<void>;
  removeAssignment: (assignmentId: string) => Promise<void>;
  replaceAssignment: (assignmentId: string, formData: FormData) => Promise<void>;
  markAssignmentAttended: (assignmentId: string) => Promise<void>;
  markAssignmentNotAttended: (assignmentId: string, replacementUserId: string | null) => Promise<void>;
  updateAssignmentStatus: (assignmentId: string, status: "erledigt" | "abgesagt", replacementUserId: string | null) => Promise<void>;
};

function timeStr(t: string | null | undefined): string {
  const s = String(t ?? "").trim();
  return s.slice(0, 5) || "–";
}

/** Prüft, ob die Schicht zeitlich begonnen hat (Datum + Startzeit in der Vergangenheit). Ab dann kann Antreten/Ersatz abgefragt werden. */
function isShiftStarted(shift: { date?: string; start_time?: string }, todayStr: string): boolean {
  const dateStr = (shift.date ?? "").trim();
  if (!dateStr) return false;
  if (dateStr < todayStr) return true;
  if (dateStr > todayStr) return false;
  const start = String(shift.start_time ?? "00:00").trim().slice(0, 5);
  const shiftStart = new Date(`${dateStr}T${start}`);
  return !isNaN(shiftStart.getTime()) && new Date() >= shiftStart;
}

export default function ShiftPlanTableWithEdit({
  shifts,
  todayStr,
  profileNames,
  membersSortedByLoad,
  assignToShift,
  deleteShift,
  deleteEventShifts,
  updateShift,
  updateEventGroup,
  removeAssignment,
  replaceAssignment,
  markAssignmentAttended,
  markAssignmentNotAttended,
  updateAssignmentStatus
}: Props) {
  const router = useRouter();
  const [editingShifts, setEditingShifts] = useState<any[] | null>(null);

  /** Nach Personenänderung werden Schichten neu geladen – Modal-Daten synchronisieren */
  useEffect(() => {
    if (!editingShifts?.length || !shifts?.length) return;
    const ids = editingShifts.map((s: any) => s.id);
    const updated = ids.map((id) => shifts.find((s: any) => s.id === id)).filter(Boolean);
    if (updated.length === ids.length) setEditingShifts(updated);
  }, [shifts]);
  const [editingPersonsOnly, setEditingPersonsOnly] = useState(false);
  const [notAttendedAssignmentId, setNotAttendedAssignmentId] = useState<string | null>(null);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);

  const byDate = (shifts as any[]).reduce(
    (acc: Record<string, any[]>, s: any) => {
      const d = s.date;
      if (!acc[d]) acc[d] = [];
      acc[d].push(s);
      return acc;
    },
    {}
  );
  const dates = Object.keys(byDate).sort();

  /** Gruppiert Schichten zu einer Veranstaltung (z. B. Karnevalsparty – 14:30–15:30 → Karnevalsparty). */
  const eventGroupKey = (eventName: string) =>
    String(eventName ?? "")
      .trim()
      .replace(/\s*–\s*[12]\.\s*Pause$/i, "")
      .replace(/\s*–\s*\d{1,2}:\d{2}–\d{1,2}:\d{2}$/, "")
      .trim() || "—";

  const sortShiftsByTime = (arr: any[]) =>
    [...arr].sort((a, b) => {
      const ta = String(a.start_time ?? "").replace(":", "");
      const tb = String(b.start_time ?? "").replace(":", "");
      return ta.localeCompare(tb);
    });

  const byDateAndEvent = (dateStr: string) => {
    const dayShifts = sortShiftsByTime(byDate[dateStr] ?? []);
    const map = new Map<string, any[]>();
    for (const s of dayShifts) {
      const key = eventGroupKey(s.event_name);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).map(([k, v]) => [k, sortShiftsByTime(v)] as [string, any[]]);
  };

  const renderEditStatusForm = (a: AssignmentRow) => {
    const name = profileNames.get(a.user_id ?? "") ?? "?";
    const showReplacement = notAttendedAssignmentId === a.id;
    return (
      <li key={a.id} className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-[11px]">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="truncate font-medium text-gray-900">{name}</span>
          <button type="button" onClick={() => { setEditingAssignmentId(null); setNotAttendedAssignmentId(null); }} className="shrink-0 text-[10px] text-gray-500 hover:text-gray-700">Schließen</button>
        </div>
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          <form action={async () => { await updateAssignmentStatus(a.id, "erledigt", null); setEditingAssignmentId(null); setNotAttendedAssignmentId(null); router.refresh(); }} className="inline">
            <SubmitButtonWithSpinner className="rounded bg-green-500/25 px-2 py-1 sm:px-1.5 sm:py-0.5 text-[10px] text-green-300 hover:bg-green-500/35 disabled:opacity-70 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center" loadingLabel="…">✓ Antreten</SubmitButtonWithSpinner>
          </form>
          <button type="button" onClick={() => setNotAttendedAssignmentId(a.id)} className="rounded bg-amber-500/25 px-2 py-1 sm:px-1.5 sm:py-0.5 text-[10px] text-amber-300 hover:bg-amber-500/35 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center">✗ Nicht angetreten</button>
        </div>
        {showReplacement && (
          <form action={async (fd: FormData) => { const uid = fd.get("replacement_user_id")?.toString() || null; await updateAssignmentStatus(a.id, "abgesagt", uid); setNotAttendedAssignmentId(null); setEditingAssignmentId(null); router.refresh(); }} className="space-y-1.5 border-t border-gray-200 pt-1">
            <label className="mb-0.5 block text-[10px] text-gray-600">Ersatz</label>
            <select name="replacement_user_id" className="max-w-full rounded border border-gray-300 bg-white px-1.5 py-1.5 text-[10px] sm:py-0.5" defaultValue={a.replacement_user_id ?? ""}>
              <option value="">– Kein Ersatz</option>
              {membersSortedByLoad.filter((m) => m.id !== a.user_id).map((m) => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
            <div className="flex gap-1.5">
              <SubmitButtonWithSpinner className="rounded bg-blue-100 px-2 py-1 text-[10px] text-blue-700 hover:bg-blue-200 disabled:opacity-70 sm:px-1.5 sm:py-0.5" loadingLabel="…">OK</SubmitButtonWithSpinner>
              <button type="button" onClick={() => setNotAttendedAssignmentId(null)} className="rounded px-2 py-1 text-[10px] text-gray-600 hover:bg-blue-100 sm:px-1.5 sm:py-0.5">Abbr.</button>
            </div>
          </form>
        )}
      </li>
    );
  };

  const renderStatusBlock = (s: any, assignments: AssignmentRow[], isPast: boolean, statusText: string) => (
    isPast ? (
      <ul className="space-y-1.5 sm:space-y-2">
        {assignments.map((a) => {
          const name = profileNames.get(a.user_id ?? "") ?? "?";
          const replacementName = a.replacement_user_id
            ? profileNames.get(a.replacement_user_id) ?? "?"
            : null;
          const isEditingThis = editingAssignmentId === a.id;

          if (isEditingThis) {
            return renderEditStatusForm(a);
          }
          if (a.status === "erledigt") {
            return (
              <li key={a.id} className="flex items-center gap-2 rounded-md border border-green-500/25 bg-green-500/10 px-2 py-1 text-[11px]">
                <span className="text-green-400 shrink-0" aria-hidden>✓</span>
                <button type="button" onClick={() => setEditingAssignmentId(a.id)} className="truncate text-left text-green-200/90 hover:underline focus:outline-none focus:underline min-w-0">
                  {name}
                </button>
              </li>
            );
          }
          if (a.status === "abgesagt") {
            return (
              <li key={a.id} className="rounded-md border border-red-500/25 bg-red-500/10 px-2 py-1 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="text-red-400 shrink-0" aria-hidden>✗</span>
                  <button type="button" onClick={() => { setEditingAssignmentId(a.id); setNotAttendedAssignmentId(a.id); }} className={replacementName ? "min-w-0 truncate text-left text-red-600 hover:underline" : "min-w-0 truncate text-left text-gray-400 line-through hover:underline"}>
                    {name}
                  </button>
                </div>
                {replacementName && <div className="mt-1 pl-4 text-[10px] text-gray-600 truncate">Ersatz: {replacementName}</div>}
              </li>
            );
          }
          const showReplacement = notAttendedAssignmentId === a.id;
          return (
            <li key={a.id} className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[11px]">
              <div className="mb-1 truncate font-medium text-gray-900">{name}</div>
              {!showReplacement ? (
                <div className="flex flex-wrap gap-1.5">
                  <form action={async () => { await markAssignmentAttended(a.id); setNotAttendedAssignmentId(null); router.refresh(); }} className="inline">
                    <SubmitButtonWithSpinner className="rounded bg-green-500/25 px-2 py-1 sm:px-1.5 sm:py-0.5 text-[10px] text-green-300 hover:bg-green-500/35 disabled:opacity-70 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center" loadingLabel="…">✓</SubmitButtonWithSpinner>
                  </form>
                  <button type="button" onClick={() => setNotAttendedAssignmentId(a.id)} className="rounded bg-amber-500/25 px-2 py-1 sm:px-1.5 sm:py-0.5 text-[10px] text-amber-300 hover:bg-amber-500/35 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center">✗</button>
                </div>
              ) : (
                <form action={async (fd: FormData) => { const uid = fd.get("replacement_user_id")?.toString() || null; await markAssignmentNotAttended(a.id, uid); setNotAttendedAssignmentId(null); router.refresh(); }} className="space-y-1.5">
                  <div>
                    <label className="mb-0.5 block text-[10px] text-gray-600">Ersatz</label>
                    <select name="replacement_user_id" className="max-w-full rounded border border-gray-300 bg-white px-1.5 py-1.5 text-[10px] sm:py-0.5">
                      <option value="">–</option>
                      {membersSortedByLoad.filter((m) => m.id !== a.user_id).map((m) => (
                        <option key={m.id} value={m.id}>{m.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-1.5">
                    <SubmitButtonWithSpinner className="rounded bg-blue-100 px-2 py-1 text-[10px] text-blue-700 hover:bg-blue-200 disabled:opacity-70 sm:px-1.5 sm:py-0.5" loadingLabel="…">OK</SubmitButtonWithSpinner>
                    <button type="button" onClick={() => setNotAttendedAssignmentId(null)} className="rounded px-2 py-1 text-[10px] text-gray-600 hover:bg-blue-100 sm:px-1.5 sm:py-0.5">Abbr.</button>
                  </div>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    ) : (
      statusText
    )
  );

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {dates.map((dateStr) => {
          const dateLabel = formatDateLabel(dateStr);
          const eventGroups = byDateAndEvent(dateStr);
          return (
            <div
              key={dateStr}
              className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              <div className="border-b border-gray-200 bg-gray-50 px-3 py-2">
                <h4 className="text-xs font-semibold tracking-wide text-gray-900">
                  {dateLabel}
                </h4>
              </div>
              <div className="p-3 space-y-5">
              {eventGroups.map(([eventName, dayShifts]) => {
                  const firstShift = dayShifts[0];
                  const headerOrt = firstShift?.location?.trim();
                  const headerInfos = firstShift?.notes?.trim();
                  return (
                <div key={`${dateStr}-${eventName}`} className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                  <div className="space-y-1 border-b border-gray-200 bg-white px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-xs font-medium text-gray-900">
                        {eventName || "—"}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => { setEditingShifts(dayShifts); setEditingPersonsOnly(false); }} className="flex min-h-[36px] items-center justify-center rounded bg-blue-100 px-2 py-1 text-[10px] text-blue-700 hover:bg-blue-200 sm:min-h-0" title="Veranstaltung bearbeiten">✎</button>
                        <form action={deleteEventShifts} className="inline">
                          <input type="hidden" name="eventName" value={eventName} />
                          <input type="hidden" name="eventDate" value={dateStr} />
                          <SubmitButtonWithSpinner
                            className="flex min-h-[36px] items-center justify-center rounded bg-red-100 px-2 py-1 text-[10px] text-red-600 hover:bg-red-200 disabled:opacity-70 sm:min-h-0"
                            title="Delete event"
                            loadingLabel="…"
                          >
                            Löschen
                          </SubmitButtonWithSpinner>
                        </form>
                      </div>
                    </div>
                    {(headerOrt || headerInfos) && (
                      <div className="truncate text-[10px] text-gray-500" title={[headerOrt, headerInfos].filter(Boolean).join(" — ") || undefined}>
                        {[headerOrt, headerInfos].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>

                  {/* Mobile: Karten pro Schicht */}
                  <div className="sm:hidden p-2 space-y-2">
                    {dayShifts.map((s: any) => {
                      const assignments = (s.shift_assignments ?? []) as AssignmentRow[];
                      const names = assignments.map(
                        (a) => profileNames.get(a.user_id ?? "") ?? "?"
                      );
                      const isPast = isShiftStarted(s, todayStr);
                      const done = assignments.filter((a) => a.status === "erledigt").length;
                      const statusText =
                        done === assignments.length && assignments.length > 0
                          ? "erledigt"
                          : assignments.length > 0
                            ? `${done}/${assignments.length}`
                            : "–";
                      return (
                        <div
                          key={s.id}
                          className="space-y-1.5 rounded-lg border border-gray-200 bg-gray-50 p-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-medium text-gray-700">
                                {timeStr(s.start_time)}–{timeStr(s.end_time)}
                                {(s.has_aufbau || s.has_abbau) && (
                                  <span className="ml-1 text-[10px] text-gray-500">
                                    ({[s.has_aufbau && "Aufbau", s.has_abbau && "Abbau"].filter(Boolean).join(" + ")})
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-col gap-0.5 text-[10px] text-gray-600">
                                {names.length > 0 ? names.map((name, i) => <span key={i} className="truncate" title={name}>{name}</span>) : "–"}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 touch-manipulation">
                              <button type="button" onClick={() => { setEditingShifts([s]); setEditingPersonsOnly(true); }} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded bg-blue-100 text-sm text-blue-700 hover:bg-blue-200" title="Personen" aria-label="Personen">✎</button>
                              <form action={deleteShift} className="inline">
                                <input type="hidden" name="shiftId" value={s.id} />
                                <SubmitButtonWithSpinner className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-70 text-sm" title="Entfernen" loadingLabel="…" aria-label="Entfernen">✕</SubmitButtonWithSpinner>
                              </form>
                            </div>
                          </div>
                          <div className="border-t border-gray-200 pt-1.5 text-[11px] text-gray-600">
                            {renderStatusBlock(s, assignments, isPast, statusText)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop: Tabelle */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="min-w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-[11px] font-medium text-gray-700">
                          <th className="py-2 px-2 text-left w-24">Zeit</th>
                          <th className="py-2 px-2 text-left max-w-[100px]">Personen</th>
                          <th className="py-2 px-2 text-left min-w-[140px]">Status</th>
                          <th className="py-2 px-2 w-20 text-right"></th>
                        </tr>
                      </thead>
                      <tbody>
                  {dayShifts.map((s: any, idx: number) => {
                    const assignments = (s.shift_assignments ?? []) as AssignmentRow[];
                    const names = assignments.map(
                      (a) => profileNames.get(a.user_id ?? "") ?? "?"
                    );
                    const isPast = isShiftStarted(s, todayStr);
                    const done = assignments.filter((a) => a.status === "erledigt").length;
                    const statusText =
                      done === assignments.length && assignments.length > 0
                        ? "erledigt"
                        : assignments.length > 0
                          ? `${done}/${assignments.length}`
                          : "–";
                    return (
                      <tr key={s.id} className={idx % 2 === 0 ? "bg-transparent" : "bg-gray-50"}>
                        <td className="w-24 whitespace-nowrap px-2 py-2 text-[11px] text-gray-700">
                          {timeStr(s.start_time)}–{timeStr(s.end_time)}
                          {(s.has_aufbau || s.has_abbau) && (
                            <span className="ml-1 text-[10px] text-gray-500">
                              ({[s.has_aufbau && "Aufbau", s.has_abbau && "Abbau"].filter(Boolean).join(" + ")})
                            </span>
                          )}
                        </td>
                        <td className="max-w-[100px] px-2 py-2 align-top text-gray-700">
                          {names.length > 0 ? (
                            <div className="flex flex-col gap-0.5 text-[11px]">
                              {names.map((name, i) => (
                                <span key={i} className="truncate" title={name}>{name}</span>
                              ))}
                            </div>
                          ) : "–"}
                        </td>
                        <td className="min-w-[140px] px-2 py-2 align-top text-gray-600">
                          {renderStatusBlock(s, assignments, isPast, statusText)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => { setEditingShifts([s]); setEditingPersonsOnly(true); }} className="rounded bg-blue-100 px-2 py-1 text-[11px] text-blue-700 hover:bg-blue-200" title="Personen">✎</button>
                            <form action={deleteShift} className="inline">
                              <input type="hidden" name="shiftId" value={s.id} />
                              <SubmitButtonWithSpinner className="rounded bg-red-500/20 px-2 py-1 text-[11px] text-red-300 hover:bg-red-500/30 disabled:opacity-70" title="Entfernen" loadingLabel="…">✕</SubmitButtonWithSpinner>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                      </tbody>
                    </table>
                  </div>
                </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {editingShifts != null && editingShifts.length > 0 && (
        <ShiftEditModal
          shift={{
            id: editingShifts[0].id,
            event_name: editingShifts[0].event_name ?? "",
            date: String(editingShifts[0].date ?? ""),
            start_time: String(editingShifts[0].start_time ?? ""),
            end_time: String(editingShifts[0].end_time ?? ""),
            location: editingShifts[0].location ?? null,
            notes: editingShifts[0].notes ?? null
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
          onClose={() => { setEditingShifts(null); setEditingPersonsOnly(false); }}
          onRefresh={router.refresh}
          personsOnly={editingPersonsOnly}
          allShiftsWithAssignments={editingShifts.length > 1 && !editingPersonsOnly && updateEventGroup
            ? editingShifts.map((s: any) => ({
                shift: {
                  id: s.id,
                  event_name: s.event_name ?? "",
                  date: String(s.date ?? ""),
                  start_time: String(s.start_time ?? ""),
                  end_time: String(s.end_time ?? ""),
                  location: s.location ?? null,
                  notes: s.notes ?? null
                },
                assignments: (s.shift_assignments ?? []).map((a: any) => ({
                  id: a.id,
                  user_id: a.user_id ?? "",
                  status: a.status ?? "zugewiesen"
                }))
              }))
            : undefined}
          updateEventGroup={updateEventGroup}
        />
      )}
    </>
  );
}

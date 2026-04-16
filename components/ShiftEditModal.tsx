"use client";

import { useEffect, useState } from "react";
import SubmitButtonWithSpinner from "./SubmitButtonWithSpinner";
import AssignmentKindHelpIcon from "./shifts/AssignmentKindHelpIcon";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";

type Shift = {
  id: string;
  event_name: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  notes: string | null;
  assignment_kind?: string | null;
  attendance_mode?: string | null;
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
  /** When false, hide auto/rotation assignment options (Engagement module off). Legacy kinds stay editable via read-only + hidden field. */
  engagementEnabled?: boolean;
  /** When false, hide `auto_assign` even if engagement is enabled (e.g. Free plan). */
  allowAutoAssign?: boolean;
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
  return String(eventName ?? "").trim().replace(/\s*–\s*[12]\.\s*(?:Pause|Break)$/i, "").trim() || String(eventName ?? "");
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
  updateEventGroup,
  engagementEnabled = true,
  allowAutoAssign = true
}: Props) {
  const { locale } = useLocale();
  const [assignmentKindLocal, setAssignmentKindLocal] = useState(shift.assignment_kind ?? "self_signup");
  useEffect(() => {
    setAssignmentKindLocal(shift.assignment_kind ?? "self_signup");
  }, [shift.id, shift.assignment_kind]);

  const kindParsed = String(shift.assignment_kind ?? "self_signup");
  const legacyEngagementKind =
    !engagementEnabled && (kindParsed === "auto_assign" || kindParsed === "rotation");

  useEffect(() => {
    if (!legacyEngagementKind) return;
    setAssignmentKindLocal("self_signup");
  }, [legacyEngagementKind, shift.id]);

  useEffect(() => {
    if (!allowAutoAssign && assignmentKindLocal === "auto_assign") setAssignmentKindLocal("self_signup");
  }, [allowAutoAssign, assignmentKindLocal]);
  const isEventGroup = (allShiftsWithAssignments?.length ?? 0) > 1 && updateEventGroup;
  const totalAssignments = allShiftsWithAssignments?.reduce((sum, s) => sum + s.assignments.length, 0) ?? assignments.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={personsOnly ? t("shifts.edit_persons", locale) : t("shifts.edit_shift", locale)}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border-b-0 bg-bg-primary shadow-xl sm:max-h-[90vh] sm:rounded-xl sm:border-b border-border-subtle dark:bg-bg-primary dark:border-border-default pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-bg-secondary px-3 py-2.5 sm:py-2 dark:border-border-default dark:bg-bg-primary">
          <h3 className="text-xs font-semibold text-text-primary dark:text-text-primary">
            {personsOnly ? t("shifts.edit_persons", locale) : isEventGroup ? t("shifts.edit_event_all", locale) : t("shifts.edit_shift", locale)}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="-m-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded p-2 text-text-secondary hover:bg-[var(--bg-brand-subtle)] focus:outline-none touch-manipulation dark:text-text-secondary dark:hover:bg-bg-tertiary"
            aria-label={t("common.close", locale)}
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
              <label className="text-[10px] font-semibold text-text-secondary dark:text-text-secondary block mb-0.5">{t("shifts.event_label", locale)}</label>
              <input
                type="text"
                name="event_name"
                required
                defaultValue={isEventGroup ? baseEventNameForEdit(shift.event_name) : shift.event_name}
                className="w-full rounded border border-border-default bg-bg-primary p-2.5 text-xs min-h-[44px] dark:border-border-default dark:bg-bg-primary dark:text-text-primary sm:min-h-0 sm:p-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-text-secondary dark:text-text-secondary block mb-0.5">{t("shifts.date", locale)}</label>
                <input
                  type="date"
                  name="date"
                  required
                  defaultValue={dateForInput(shift.date)}
                  className="w-full rounded border border-border-default bg-bg-primary p-2.5 text-xs min-h-[44px] dark:border-border-default dark:bg-bg-primary dark:text-text-primary sm:min-h-0 sm:p-2"
                />
              </div>
              {!isEventGroup && (
              <div>
                <label className="text-[10px] font-semibold text-text-secondary dark:text-text-secondary block mb-0.5">{t("shifts.time_label", locale)}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    name="start_time"
                    required
                    defaultValue={timeForInput(shift.start_time)}
                    className="w-full rounded border border-border-default bg-bg-primary p-2.5 text-xs min-h-[44px] dark:border-border-default dark:bg-bg-primary dark:text-text-primary sm:min-h-0 sm:p-2"
                  />
                  <span className="text-text-secondary/80 text-xs">–</span>
                  <input
                    type="time"
                    name="end_time"
                    required
                    defaultValue={timeForInput(shift.end_time)}
                    className="w-full rounded border border-border-default bg-bg-primary p-2.5 text-xs min-h-[44px] dark:border-border-default dark:bg-bg-primary dark:text-text-primary sm:min-h-0 sm:p-2"
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
              <label className="text-[10px] font-semibold text-text-secondary dark:text-text-secondary block mb-0.5">{t("shifts.location", locale)}</label>
              <input
                type="text"
                name="location"
                defaultValue={shift.location ?? ""}
                placeholder={t("shifts.location_placeholder_short", locale)}
                className="w-full rounded border border-border-default bg-bg-primary p-2.5 text-xs min-h-[44px] dark:border-border-default dark:bg-bg-primary dark:text-text-primary sm:min-h-0 sm:p-2"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-text-secondary dark:text-text-secondary block mb-0.5">{t("shifts.notes_label", locale)}</label>
              <textarea
                name="notes"
                rows={2}
                defaultValue={shift.notes ?? ""}
                placeholder={t("shifts.notes_placeholder", locale)}
                className="w-full rounded border border-border-default bg-bg-primary p-2 text-xs resize-y dark:border-border-default dark:bg-bg-primary dark:text-text-primary"
              />
            </div>
            {!isEventGroup && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <label className="text-[10px] font-semibold text-text-secondary dark:text-text-secondary block">
                      {t("shifts.assignment_kind_field", locale)}
                    </label>
                    <AssignmentKindHelpIcon kind={assignmentKindLocal} engagementBased={engagementEnabled} />
                  </div>
                  {legacyEngagementKind ? (
                    <p className="mb-1.5 rounded border border-amber-200/80 bg-amber-50 px-2 py-1.5 text-[10px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                      {locale === "de"
                        ? `Bisher: ${t(`shifts.assignment_kind_label_${kindParsed}` as "shifts.assignment_kind_label_auto_assign", locale)}. Engagement ist aus — Speichern setzt die Zuteilung auf die unten gewählte Option.`
                        : `Was: ${t(`shifts.assignment_kind_label_${kindParsed}` as "shifts.assignment_kind_label_auto_assign", locale)}. Engagement is off — saving applies the mode selected below.`}
                    </p>
                  ) : null}
                  <select
                    name="assignment_kind"
                    value={assignmentKindLocal}
                    onChange={(e) => setAssignmentKindLocal(e.target.value)}
                    className="w-full rounded border border-border-default bg-bg-primary p-2.5 text-xs min-h-[44px] dark:border-border-default dark:bg-bg-primary dark:text-text-primary sm:min-h-0 sm:p-2"
                  >
                    <option value="self_signup">{t("shifts.assignment_kind_label_self_signup", locale)}</option>
                    {engagementEnabled ? (
                      <>
                        {allowAutoAssign ? (
                          <option value="auto_assign">{t("shifts.assignment_kind_label_auto_assign", locale)}</option>
                        ) : null}
                        <option value="rotation">{t("shifts.assignment_kind_label_rotation", locale)}</option>
                      </>
                    ) : null}
                    <option value="fixed">{t("shifts.assignment_kind_label_fixed", locale)}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-text-secondary dark:text-text-secondary mb-0.5 block">
                    {t("shifts.attendance_mode_field", locale)}
                  </label>
                  <select
                    name="attendance_mode"
                    defaultValue={shift.attendance_mode ?? "qr"}
                    className="w-full rounded border border-border-default bg-bg-primary p-2.5 text-xs min-h-[44px] dark:border-border-default dark:bg-bg-primary dark:text-text-primary sm:min-h-0 sm:p-2"
                  >
                    <option value="qr">{t("shifts.attendance_mode_label_qr", locale)}</option>
                    <option value="admin_only">{t("shifts.attendance_mode_label_admin_only", locale)}</option>
                    <option value="none">{t("shifts.attendance_mode_label_none", locale)}</option>
                  </select>
                </div>
              </div>
            )}
            <SubmitButtonWithSpinner
              className="rounded bg-blue-600 px-3 py-2.5 text-[11px] text-white hover:bg-blue-700 sm:px-2.5 sm:py-1 disabled:opacity-70 min-h-[44px] sm:min-h-0 touch-manipulation dark:bg-blue-500 dark:hover:bg-blue-600"
              loadingLabel="…"
            >
              {t("common.save", locale)}
            </SubmitButtonWithSpinner>
          </form>
          )}

          {isEventGroup ? (
            <details className="border-t border-border-subtle pt-2 group">
              <summary className="list-none cursor-pointer flex items-center gap-2 py-1.5 text-[11px] font-semibold text-text-secondary hover:text-text-primary dark:text-text-secondary dark:hover:text-text-primary">
                <span className="w-4 h-4 flex items-center justify-center text-text-secondary transition-transform group-open:rotate-90" aria-hidden>▶</span>
                {t("shifts.persons_count", locale).replace("{count}", String(totalAssignments))}
              </summary>
              <div className="pl-6 pt-2 space-y-4">
                {allShiftsWithAssignments!.map(({ shift: s, assignments: aList }) => (
                  <div key={s.id} className="rounded border border-border-subtle bg-bg-secondary p-2 space-y-2">
                    <p className="text-[10px] font-semibold text-text-secondary/90">{timeStr(s.start_time)}–{timeStr(s.end_time)}</p>
                    {aList.length === 0 ? (
                      <p className="text-[11px] text-text-secondary/60 dark:text-text-muted">{t("shifts.no_one_assigned", locale)}</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {aList.map((a) => (
                          <li key={a.id} className="flex items-center gap-2 rounded border border-border-subtle bg-bg-primary px-2 py-1.5 dark:border-border-default dark:bg-bg-primary">
                            <span className="flex-1 text-[11px] text-text-primary truncate">{profileNames.get(a.user_id ?? "") ?? "–"}</span>
                            <form action={async (fd: FormData) => { const uid = fd.get("user_id")?.toString(); if (uid) { await replaceAssignment(a.id, fd); onRefresh?.(); } }} className="flex items-center gap-1">
                              <select name="user_id" className="rounded border border-border-default bg-bg-primary px-1 py-0.5 text-[10px] dark:border-border-default dark:bg-bg-primary dark:text-text-primary">
                                <option value="">{t("shifts.replace", locale)}</option>
                                {members.filter((m) => m.id !== a.user_id).map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                              </select>
                              <SubmitButtonWithSpinner className="rounded bg-[var(--bg-brand-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--color-brand-text)]" loadingLabel="…">{t("shifts.replace", locale)}</SubmitButtonWithSpinner>
                            </form>
                            <form action={async () => { await removeAssignment(a.id); onRefresh?.(); }}>
                              <SubmitButtonWithSpinner
                                variant="destructive"
                                buttonSize="sm"
                                className="px-1.5 py-0.5 text-[10px]"
                                title={t("common.remove", locale)}
                                loadingLabel="…"
                              >
                                ✕
                              </SubmitButtonWithSpinner>
                            </form>
                          </li>
                        ))}
                      </ul>
                    )}
                    <form action={async (fd: FormData) => { const uid = fd.get("user_id")?.toString(); if (uid) { await assignToShift(s.id, fd); onRefresh?.(); } }} className="flex items-center gap-2">
                      <select name="user_id" className="rounded border border-border-default bg-bg-primary px-1.5 py-0.5 text-[10px] flex-1 min-w-0 dark:border-border-default dark:bg-bg-primary dark:text-text-primary">
                        <option value="">{t("shifts.add_short", locale)}</option>
                        {members.filter((m) => !aList.some((a) => a.user_id === m.id)).map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                      </select>
                      <SubmitButtonWithSpinner className="rounded shrink-0 bg-[var(--bg-brand-subtle)] px-2 py-0.5 text-[10px] text-[var(--color-brand-text)]" loadingLabel="…">+</SubmitButtonWithSpinner>
                    </form>
                  </div>
                ))}
              </div>
            </details>
          ) : (
          <div className={personsOnly ? "" : "border-t border-border-subtle pt-2 dark:border-border-default"}>
            <p className="text-[10px] font-semibold text-text-secondary dark:text-text-secondary mb-1.5">{t("shifts.persons_count", locale).replace("{count}", String(assignments.length))}</p>
            {assignments.length === 0 ? (
              <p className="text-[11px] text-text-secondary/70 dark:text-text-muted mb-1.5">{t("shifts.no_one_assigned", locale)}</p>
            ) : (
              <ul className="space-y-2">
                {assignments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 rounded border border-border-subtle bg-bg-secondary px-3 py-2"
                  >
                    <span className="flex-1 text-xs text-text-primary">
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
                        className="rounded border border-border-default bg-bg-primary px-1.5 py-0.5 text-[10px] dark:border-border-default dark:bg-bg-primary dark:text-text-primary"
                      >
                        <option value="">{t("shifts.replace", locale)} …</option>
                        {members
                          .filter((m) => m.id !== a.user_id)
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.full_name}
                            </option>
                          ))}
                      </select>
                      <SubmitButtonWithSpinner
                        className="inline-flex items-center gap-1.5 rounded bg-[var(--bg-brand-subtle)] px-2 py-1 text-[11px] text-[var(--color-brand-text)] hover:opacity-90 disabled:opacity-70 dark:bg-blue-900/30 dark:text-blue-300"
                        loadingLabel="…"
                      >
                        {t("shifts.replace", locale)}
                      </SubmitButtonWithSpinner>
                    </form>
                    <form action={async () => { await removeAssignment(a.id); onRefresh?.(); }}>
                      <SubmitButtonWithSpinner
                        variant="destructive"
                        buttonSize="sm"
                        className="px-1.5 py-0.5 text-[10px]"
                        title={t("common.remove", locale)}
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
                className="rounded border border-border-default bg-bg-primary px-1.5 py-0.5 text-[11px] dark:border-border-default dark:bg-bg-primary dark:text-text-primary"
              >
                <option value="">{t("shifts.add_short", locale)}</option>
                {members
                  .filter((m) => !assignments.some((a) => a.user_id === m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
              </select>
              <SubmitButtonWithSpinner
                className="inline-flex items-center gap-1.5 rounded bg-[var(--bg-brand-subtle)] px-2 py-1 text-xs text-[var(--color-brand-text)] hover:opacity-90 disabled:opacity-70"
                loadingLabel="…"
              >
                {t("shifts.add_short", locale).replace(" …", "")}
              </SubmitButtonWithSpinner>
            </form>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

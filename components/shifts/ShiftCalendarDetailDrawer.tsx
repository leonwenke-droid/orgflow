"use client";

import type { ShiftForPdf } from "../ShiftAttendancePdfExport";
import { useLocale } from "../LocaleProvider";
import { t } from "../../lib/i18n";

export default function ShiftCalendarDetailDrawer({
  shift,
  profileNames,
  onClose
}: {
  shift: ShiftForPdf;
  profileNames: Record<string, string>;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const assigns = shift.shift_assignments ?? [];
  const req = Math.max(1, Number(shift.required_slots ?? 1) || 1);

  return (
    <div
      className="shifts-console fixed inset-0 z-[100] flex items-center justify-end bg-black/55 p-2 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default"
        aria-label={t("shifts.console_drawer_close", locale)}
        onClick={onClose}
      />
      <div className="sc-card relative z-10 max-h-[min(92vh,640px)] w-full max-w-md overflow-y-auto shadow-2xl">
        <div className="sc-card-hd flex items-center justify-between gap-2">
          <span className="min-w-0 truncate">{shift.event_name || "—"}</span>
          <button type="button" className="sc-btn shrink-0 text-xs" onClick={onClose}>
            {t("shifts.console_drawer_close", locale)}
          </button>
        </div>
        <div className="space-y-3 p-4 text-sm" style={{ color: "var(--sc-text2)" }}>
          <p>
            <span className="font-semibold" style={{ color: "var(--sc-text)" }}>
              {shift.date}
            </span>{" "}
            · {String(shift.start_time ?? "").slice(0, 5)}–{String(shift.end_time ?? "").slice(0, 5)}
            {shift.location ? ` · ${shift.location}` : ""}
          </p>
          <p className="text-xs">
            {assigns.length}/{req} {locale === "de" ? "Plätze belegt" : "slots filled"}
          </p>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--sc-text3)" }}>
              {locale === "de" ? "Zuweisungen" : "Assignments"}
            </p>
            <ul className="space-y-1.5">
              {assigns.length === 0 ? (
                <li className="text-xs opacity-80">{locale === "de" ? "Noch niemand" : "Nobody yet"}</li>
              ) : (
                assigns.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs"
                    style={{ borderColor: "var(--sc-border)", background: "var(--sc-surface2)" }}
                  >
                    <span className="truncate" style={{ color: "var(--sc-text)" }}>
                      {profileNames[a.user_id] ?? "?"}
                    </span>
                    {a.checked_in_at ? (
                      <span className="shrink-0 text-[10px]" style={{ color: "var(--sc-success)" }}>
                        ✓
                      </span>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

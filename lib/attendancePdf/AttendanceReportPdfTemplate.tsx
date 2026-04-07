import React from "react";
import { attendanceTranslations, type AttendancePdfLocale } from "./translations";
import type { AttendanceAssignmentRow, AttendanceReport } from "./types";

/** Reference template uses en dash for “open” in legend / chips */
function statusSymbol(kind: AttendanceAssignmentRow["statusKind"]): string {
  switch (kind) {
    case "present":
      return "✓";
    case "pending":
      return "~";
    case "absent":
    case "cancelled":
      return "✗";
    case "open":
      return "\u2013";
    default:
      return "";
  }
}

function statusLabel(kind: AttendanceAssignmentRow["statusKind"], t: (typeof attendanceTranslations)["en"]) {
  switch (kind) {
    case "present":
      return t.present;
    case "pending":
      return t.pending;
    case "absent":
      return t.absent;
    case "cancelled":
      return t.cancelled;
    case "open":
      return t.open;
    default:
      return "";
  }
}

function statusChipClass(kind: AttendanceAssignmentRow["statusKind"]): string {
  switch (kind) {
    case "present":
      return "present";
    case "pending":
      return "pending";
    case "absent":
      return "absent";
    case "cancelled":
      return "cancelled";
    case "open":
      return "open";
    default:
      return "open";
  }
}

function slotPillClass(filled: number, total: number): string {
  if (total <= 0) return "low";
  const pct = filled / total;
  if (pct >= 1) return "full";
  if (pct >= 0.5) return "partial";
  return "low";
}

/**
 * Attendance PDF — layout aligned with `OrgFlow_Attendance_Template.html` (brand, header, legend, table, signature).
 * Copy via `attendanceTranslations[locale]`.
 */
export function AttendanceReportPdfTemplate({
  data,
  locale
}: {
  data: AttendanceReport;
  locale: AttendancePdfLocale;
}) {
  const t = attendanceTranslations[locale];
  const eventLine = data.documentEventTitle?.trim() || "—";

  return (
    <div className="doc">
      <div className="p-topstripe" />

      <div className="p-header">
        <div className="p-header-left">
          <div className="p-logo-row">
            <div className="p-mark">
              <span />
              <span />
              <span />
              <span />
            </div>
            <span className="p-wordmark">{t.brand}</span>
          </div>
          <div className="p-title">{t.title}</div>
          <div className="p-subtitle">{t.subtitle}</div>
        </div>
        <div className="p-meta-block">
          <div className="p-meta-row">
            {t.organisation}: <span className="p-meta-val">{data.organisation}</span>
          </div>
          <div className="p-meta-row">
            {t.event}: <span className="p-meta-val">{eventLine}</span>
          </div>
          <div className="p-meta-row">
            {t.period}: <span className="p-meta-val">{data.periodDisplay}</span>
          </div>
          <div className="p-meta-row p-meta-row-spaced">
            {t.exported}: <span className="p-meta-val">{data.exportedAtDisplay}</span>
          </div>
        </div>
      </div>

      <div className="p-blue-bar" />

      <div className="p-legend">
        <span className="p-pill present">{t.legendPillPresentDone}</span>
        <span className="p-pill pending">{t.legendPillPendingInvited}</span>
        <span className="p-pill absent">{t.legendPillAbsentCancelled}</span>
        <span className="p-pill open">{t.legendPillOpenSlot}</span>
      </div>

      <div className="p-body">
        {data.days.map((day, di) => {
          const breakBefore =
            di > 0 && day.date !== data.days[di - 1]?.date ? " day-section-break" : "";
          return (
          <div key={`${day.date}-${day.eventTitle}-${di}`} className={`day-section${breakBefore}`}>
            {(di === 0 || data.days[di - 1]?.date !== day.date) && <div className="p-day">{day.dateHeadline}</div>}

            <div className="p-event-name">{day.eventTitle}</div>
            {day.location ? <div className="p-event-loc">{day.location}</div> : null}

            {day.shifts.map((shift) => {
              const pill = slotPillClass(shift.filledCount, shift.requiredSlots);
              return (
                <div key={shift.id} className="shift-wrap">
                  <div className="p-shift-head">
                    <span className="p-shift-time">
                      {shift.startTime} – {shift.endTime}
                    </span>
                    <span className="p-shift-title">{shift.title}</span>
                    {shift.location ? <span className="p-shift-loc">{shift.location}</span> : null}
                    <span className={`p-slot-pill ${pill}`}>{shift.slotsLabel}</span>
                  </div>

                  <table className="p-table">
                    <thead>
                      <tr>
                        <th style={{ width: "35%" }}>{t.name}</th>
                        <th style={{ width: "20%" }}>{t.role}</th>
                        <th style={{ width: "22%" }}>{t.status}</th>
                        <th style={{ width: "23%" }}>{t.checkin}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shift.rows.map((row, ri) => (
                        <tr key={ri}>
                          <td className="p-td-name">
                            {row.statusKind === "open" ? (
                              <span className="p-open-slot">{t.openSlot}</span>
                            ) : (
                              <>
                                {statusSymbol(row.statusKind)} {row.name}
                                {row.statusKind === "cancelled" && row.replacementName ? (
                                  <div className="sub-rep">
                                    {t.replacementPrefix}: {row.replacementName}
                                  </div>
                                ) : null}
                              </>
                            )}
                          </td>
                          <td className="p-td-muted">{row.role?.trim() || "—"}</td>
                          <td>
                            <span className={`status-chip ${statusChipClass(row.statusKind)}`}>
                              {statusSymbol(row.statusKind)} {statusLabel(row.statusKind, t)}
                            </span>
                          </td>
                          <td className="p-td-mono">{row.checkInDisplay ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
          );
        })}
      </div>

      <div className="p-sig">
        <div>
          <div className="p-sig-label">{t.confirmed}</div>
          <div className="p-sig-line" />
          <div className="p-sig-caption">{t.signature}</div>
        </div>
        <div className="p-sig-divider" />
        <div>
          <div className="p-sig-label">{t.sigDateTime}</div>
          <div className="p-sig-line" />
          <div className="p-sig-caption">{t.sigCaptionDate}</div>
        </div>
      </div>

      <div className="p-doc-footer">
        <span className="p-footer-brand">
          <strong>{t.brand}</strong> <span>{t.footerBrandSuffix}</span>
        </span>
      </div>
    </div>
  );
}

/** Inline CSS — matches OrgFlow_Attendance_Template.html print pane tokens */
export const attendancePdfStyles = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');

:root {
  --ink-900: #0C0C0B;
  --ink-800: #1A1A18;
  --ink-600: #3D3D3A;
  --ink-400: #888780;
  --ink-200: #D3D1C7;
  --ink-100: #F2F1ED;
  --ink-50: #FAFAF8;
  --blue-600: #185FA5;
  --blue-100: #B5D4F4;
  --blue-50: #E6F1FB;
  --green-bg: #EAF3DE;
  --green-fg: #27500A;
  --amber-bg: #FAEEDA;
  --amber-fg: #633806;
  --red-bg: #FCEBEB;
  --red-fg: #791F1F;
}

* { box-sizing: border-box; }
body {
  font-family: 'DM Sans', Helvetica, Arial, sans-serif;
  color: var(--ink-900);
  font-size: 8px;
  line-height: 1.35;
  margin: 0;
  padding: 0;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.doc { max-width: 210mm; margin: 0 auto; }

.p-topstripe {
  height: 2.5mm;
  background: var(--blue-600);
}

.p-header {
  background: var(--ink-900);
  padding: 5mm 7mm 5mm;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4mm;
  align-items: start;
}
.p-header-left { min-width: 0; }
.p-logo-row {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 3mm;
}
.p-mark {
  width: 28px;
  height: 28px;
  background: rgba(255,255,255,.08);
  border-radius: 7px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2.5px;
  padding: 4px;
  flex-shrink: 0;
}
.p-mark span { border-radius: 1.5px; background: white; }
.p-mark span:nth-child(2) { opacity: .5; }
.p-mark span:nth-child(3) { opacity: .5; }
.p-mark span:nth-child(4) { opacity: .25; }
.p-wordmark { font-size: 16px; font-weight: 600; color: white; letter-spacing: -0.01em; }
.p-title { font-size: 20px; font-weight: 600; color: white; letter-spacing: -0.02em; line-height: 1.1; }
.p-subtitle { font-size: 9px; color: var(--ink-400); margin-top: 1.5mm; letter-spacing: 0.02em; }

.p-meta-block { text-align: right; }
.p-meta-row { font-size: 8px; color: var(--ink-400); margin-bottom: 2px; }
.p-meta-row-spaced { margin-top: 3px; }
.p-meta-val { color: rgba(255,255,255,.7); }

.p-blue-bar { height: 1.8mm; background: var(--blue-600); }

.p-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 3mm 7mm;
  background: var(--ink-50);
  border-bottom: 1px solid var(--ink-200);
}
.p-pill {
  font-size: 8px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 20px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.p-pill.present { background: var(--green-bg); color: var(--green-fg); }
.p-pill.pending { background: var(--amber-bg); color: var(--amber-fg); }
.p-pill.absent { background: var(--red-bg); color: var(--red-fg); }
.p-pill.open {
  background: var(--ink-100);
  color: var(--ink-400);
  border: 1px solid var(--ink-200);
}

.p-body { padding: 4mm 7mm; }

.day-section { page-break-inside: auto; }
.day-section-break {
  page-break-before: always;
}

.p-day {
  background: var(--blue-600);
  border-radius: 4px;
  padding: 2.5mm 4mm;
  font-size: 10px;
  font-weight: 600;
  color: white;
  letter-spacing: 0.01em;
  margin: 4mm 0 2.5mm;
}
.p-body > .day-section:first-child .p-day:first-child { margin-top: 0; }

.p-event-name {
  font-size: 9px;
  font-weight: 600;
  color: var(--ink-600);
  margin: 2.5mm 0 1.5mm 1.5mm;
  letter-spacing: 0.02em;
}
.p-event-loc {
  font-size: 8px;
  color: var(--ink-400);
  margin: 0 0 2mm 1.5mm;
}

.shift-wrap { margin-bottom: 3mm; page-break-inside: avoid; }

.p-shift-head {
  background: var(--ink-100);
  border-radius: 3px 3px 0 0;
  padding: 2mm 3mm;
  display: flex;
  align-items: center;
  gap: 4mm;
  flex-wrap: wrap;
  border-left: 1.5mm solid var(--blue-600);
}
.p-shift-time {
  font-size: 8.5px;
  font-weight: 600;
  color: var(--blue-600);
  font-family: 'DM Mono', ui-monospace, monospace;
  flex-shrink: 0;
  min-width: 26mm;
}
.p-shift-title {
  font-size: 8.5px;
  font-weight: 600;
  color: var(--ink-900);
  flex: 1;
  min-width: 40mm;
}
.p-shift-loc {
  font-size: 7.5px;
  color: var(--ink-400);
  flex-shrink: 0;
}
.p-slot-pill {
  font-size: 7px;
  font-weight: 600;
  padding: 1.5px 6px;
  border-radius: 20px;
  flex-shrink: 0;
  margin-left: auto;
}
.p-slot-pill.full { background: var(--green-bg); color: var(--green-fg); }
.p-slot-pill.partial { background: var(--amber-bg); color: var(--amber-fg); }
.p-slot-pill.low { background: var(--red-bg); color: var(--red-fg); }

.p-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 8px;
  margin-bottom: 3mm;
}
.p-table thead tr { background: var(--ink-900); }
.p-table thead th {
  padding: 2.5mm 3mm;
  font-weight: 600;
  color: white;
  text-align: left;
  font-size: 7.5px;
  letter-spacing: 0.03em;
}
.p-table tbody tr:nth-child(odd) { background: var(--ink-50); }
.p-table tbody tr:nth-child(even) { background: var(--ink-100); }
.p-table tbody td {
  padding: 2mm 3mm;
  color: var(--ink-600);
  border-bottom: 0.3px solid var(--ink-200);
  vertical-align: middle;
}
.p-td-name { font-weight: 500; color: var(--ink-900); }
.p-td-muted { color: var(--ink-400); }
.p-td-mono {
  font-family: 'DM Mono', ui-monospace, monospace;
  font-size: 7.5px;
}
.p-open-slot { color: var(--ink-400); font-style: italic; }

.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 7.5px;
  font-weight: 600;
  padding: 1.5px 6px;
  border-radius: 20px;
}
.status-chip.present { background: var(--green-bg); color: var(--green-fg); }
.status-chip.pending { background: var(--amber-bg); color: var(--amber-fg); }
.status-chip.absent { background: var(--red-bg); color: var(--red-fg); }
.status-chip.cancelled { background: var(--red-bg); color: var(--red-fg); }
.status-chip.open { background: var(--ink-100); color: var(--ink-400); }

.sub-rep { font-size: 7px; color: var(--blue-600); margin-top: 2px; }

.p-sig {
  background: var(--ink-100);
  border-radius: 4px;
  padding: 3mm 4mm;
  margin: 3mm 7mm 2mm;
  display: grid;
  grid-template-columns: 1fr 1px 1fr;
  gap: 4mm;
  align-items: stretch;
  page-break-inside: avoid;
}
.p-sig-divider { background: var(--ink-200); width: 1px; min-height: 100%; }
.p-sig-label { font-size: 7.5px; color: var(--ink-400); margin-bottom: 2mm; }
.p-sig-line {
  height: 0.3mm;
  background: var(--ink-200);
  margin-bottom: 1.5mm;
}
.p-sig-caption { font-size: 7px; color: var(--ink-400); text-align: center; }

.p-doc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2mm 7mm 4mm;
  background: var(--ink-100);
  border-top: 1px solid var(--ink-200);
  font-size: 8px;
}
.p-footer-brand strong { color: var(--blue-600); font-weight: 600; }
.p-footer-brand span { color: var(--ink-400); }
`;

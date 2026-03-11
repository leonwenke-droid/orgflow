"use client";

import { useCallback } from "react";
import { jsPDF } from "jspdf";

export type ShiftForPdf = {
  id: string;
  event_name: string;
  date: string;
  start_time: string;
  end_time: string;
  location?: string | null;
  has_aufbau?: boolean;
  has_abbau?: boolean;
  shift_assignments?: { id: string; status: string; user_id: string; replacement_user_id?: string | null }[];
};

type Props = {
  shifts: ShiftForPdf[];
  /** { [profileId]: full_name } – serialisierbar von Server zu Client */
  profileNames: Record<string, string>;
};

function timeStr(t: string | null | undefined): string {
  const s = String(t ?? "").trim();
  return s.slice(0, 5) || "–";
}

function formatDateLabel(d: string): string {
  const [y, m, day] = d.split("-");
  if (!day || !m || !y) return d;
  const date = new Date(d + "T12:00:00Z");
  const weekdays = ["So.", "Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa."];
  const wd = weekdays[date.getUTCDay()];
  return `${wd}, ${day}.${m}.${y}`;
}

/** Gruppiert Schichten zu einer Veranstaltung (wie im Dashboard). */
function eventGroupKey(eventName: string): string {
  return String(eventName ?? "")
    .trim()
    .replace(/\s*–\s*[12]\.\s*Pause$/i, "")
    .replace(/\s*–\s*\d{1,2}:\d{2}–\d{1,2}:\d{2}$/, "")
    .trim() || "—";
}

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 12;
const BOTTOM_LIMIT = PAGE_HEIGHT - 18;
const LINE = 4;
const CARD_PAD = 3;
const cyan = [6, 182, 212] as [number, number, number];
const cyanLight = [230, 248, 250] as [number, number, number];
const cyanBorder = [6, 182, 212] as [number, number, number];
const greenBg = [22, 101, 52] as [number, number, number];
const greenText = [74, 222, 128] as [number, number, number];
const redBg = [127, 29, 29] as [number, number, number];
const redText = [252, 165, 165] as [number, number, number];
const amberBg = [120, 53, 15] as [number, number, number];
const amberText = [251, 191, 36] as [number, number, number];
const text = [30, 41, 59] as [number, number, number];
const blockPad = 2;
const blockGap = 1;

function newPageIfNeeded(doc: jsPDF, y: number): number {
  if (y >= BOTTOM_LIMIT) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

export default function ShiftAttendancePdfExport({ shifts, profileNames }: Props) {
  const exportPdf = useCallback(() => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let y = MARGIN;

    doc.setFontSize(12);
    doc.setTextColor(...text);
    doc.setFont("helvetica", "bold");
    doc.text("Anwesenheits-Auswertung Schichtplan", MARGIN, y);
    y += LINE + 2;

    const byDate = shifts.reduce((acc: Record<string, ShiftForPdf[]>, s) => {
      const d = s.date ?? "";
      if (!acc[d]) acc[d] = [];
      acc[d].push(s);
      return acc;
    }, {});

    for (const dateStr of Object.keys(byDate).sort()) {
      const dayShifts = byDate[dateStr];
      if (dayShifts.length === 0) continue;

      const eventGroups = new Map<string, ShiftForPdf[]>();
      for (const s of dayShifts) {
        const key = eventGroupKey(s.event_name);
        if (!eventGroups.has(key)) eventGroups.set(key, []);
        eventGroups.get(key)!.push(s);
      }
      for (const [, groupShifts] of eventGroups) {
        groupShifts.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
      }

      y = newPageIfNeeded(doc, y);

      const dateCardW = PAGE_WIDTH - MARGIN * 2;
      const dateCardH = LINE + CARD_PAD * 2;
      doc.setFillColor(...cyanLight);
      doc.setDrawColor(...cyanBorder);
      doc.rect(MARGIN, y, dateCardW, dateCardH, "FD");
      doc.setTextColor(...cyan);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(formatDateLabel(dateStr), MARGIN + CARD_PAD, y + dateCardH / 2 + 1);
      y += dateCardH + CARD_PAD;

      for (const [eventName, groupShifts] of eventGroups) {
        const first = groupShifts[0];
        const location = first?.location?.trim();

        y = newPageIfNeeded(doc, y);

        const eventHeaderH = LINE + CARD_PAD * 2;
        const eventCardX = MARGIN + 4;
        const eventCardW = dateCardW - 8;
        doc.setFillColor(...cyanLight);
        doc.setDrawColor(...cyanBorder);
        doc.rect(eventCardX, y, eventCardW, eventHeaderH, "FD");
        doc.setTextColor(...text);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(eventName + (location ? `  ·  ${location}` : ""), eventCardX + CARD_PAD, y + eventHeaderH / 2 + 1);
        y += eventHeaderH;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);

        for (const s of groupShifts) {
          const assignments = s.shift_assignments ?? [];
          const timeRange = `${timeStr(s.start_time)} – ${timeStr(s.end_time)}`;

          y = newPageIfNeeded(doc, y);

          doc.setTextColor(...text);
          doc.text(timeRange, eventCardX + CARD_PAD, y + LINE / 2);
          y += LINE;

          for (const a of assignments) {
            const name = profileNames[a.user_id ?? ""] ?? "?";
            const status = a.status ?? "zugewiesen";
            const repName = status === "abgesagt" && a.replacement_user_id ? profileNames[a.replacement_user_id] ?? "?" : null;

            const hasErsatz = status === "abgesagt" && !!repName;
            const blockH = LINE + blockPad * 2 + (hasErsatz ? LINE + 1 : 0);
            y = newPageIfNeeded(doc, y);
            if (y + blockH > BOTTOM_LIMIT) {
              doc.addPage();
              y = MARGIN;
            }

            const blockY = y;
            const blockX = eventCardX + CARD_PAD;
            const blockW = eventCardW - CARD_PAD * 2;
            const textX = blockX + blockPad + 4;

            if (status === "erledigt") {
              doc.setFillColor(...greenBg);
              doc.rect(blockX, blockY, blockW, blockH, "F");
              doc.setDrawColor(...greenText);
              doc.rect(blockX, blockY, blockW, blockH, "S");
              doc.setTextColor(...greenText);
              doc.text(`✓ ${name}`, textX, blockY + blockPad + LINE * 0.8);
            } else if (status === "abgesagt") {
              doc.setFillColor(...redBg);
              doc.rect(blockX, blockY, blockW, blockH, "F");
              doc.setDrawColor(...redText);
              doc.rect(blockX, blockY, blockW, blockH, "S");
              doc.setTextColor(...redText);
              if (repName) {
                doc.text(`✗ ${name}`, textX, blockY + blockPad + LINE * 0.8);
                doc.text(`Ersatz: `, textX, blockY + blockPad + LINE + LINE * 0.8);
                doc.setTextColor(...cyan);
                const ersatzLabelW = doc.getTextWidth("Ersatz: ");
                doc.text(repName, textX + ersatzLabelW, blockY + blockPad + LINE + LINE * 0.8);
              } else {
                const txt = `✗ ${name}`;
                doc.text(txt, textX, blockY + blockPad + LINE * 0.8);
                const nameW = doc.getTextWidth(txt);
                doc.setDrawColor(...cyan);
                doc.line(textX, blockY + blockPad + LINE * 0.7, textX + nameW, blockY + blockPad + LINE * 0.7);
              }
            } else {
              doc.setFillColor(...amberBg);
              doc.rect(blockX, blockY, blockW, blockH, "F");
              doc.setDrawColor(...amberText);
              doc.rect(blockX, blockY, blockW, blockH, "S");
              doc.setTextColor(...amberText);
              doc.text(`– ${name}  offen`, textX, blockY + blockPad + LINE * 0.8);
            }
            y += blockH + blockGap;
          }
          y += 2;
        }
        y += 4;
      }
    }

    doc.save(`Anwesenheit-Schichtplan-${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [shifts, profileNames]);

  if (!shifts || shifts.length === 0) return null;

  return (
    <button
      type="button"
      onClick={exportPdf}
      className="rounded bg-cyan-500/20 px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-500/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
    >
      Anwesenheit als PDF exportieren
    </button>
  );
}

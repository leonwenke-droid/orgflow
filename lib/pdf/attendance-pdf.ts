/**
 * Client-side attendance PDF — layout, colours, and structure aligned with
 * OrgFlow_Attendance_Template.html (preview pane / print styles).
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { svg2pdf } from "svg2pdf.js";
import type {
  AttendanceExportOptions,
  AttendanceShift,
  AttendanceStatus
} from "./attendance-types";
import { PUSHPIN_SVG } from "./pushpinSvg";

/* ── Brand tokens (from :root in OrgFlow_Attendance_Template.html) ── */
const B = {
  ink900: [12, 12, 11] as [number, number, number], // #0C0C0B
  ink800: [26, 26, 24] as [number, number, number], // #1A1A18
  ink600: [61, 61, 58] as [number, number, number], // #3D3D3A
  ink400: [136, 135, 128] as [number, number, number], // #888780
  ink200: [211, 209, 199] as [number, number, number], // #D3D1C7
  ink100: [242, 241, 237] as [number, number, number], // #F2F1ED
  ink50: [250, 250, 248] as [number, number, number], // #FAFAF8
  blue600: [24, 95, 165] as [number, number, number], // #185FA5
  blue800: [12, 68, 124] as [number, number, number], // #0C447C
  blue50: [230, 241, 251] as [number, number, number], // #E6F1FB
  greenBg: [234, 243, 222] as [number, number, number], // #EAF3DE
  greenFg: [39, 80, 10] as [number, number, number], // #27500A
  amberBg: [250, 238, 218] as [number, number, number], // #FAEEDA
  amberFg: [99, 56, 6] as [number, number, number], // #633806
  redBg: [252, 235, 235] as [number, number, number], // #FCEBEB
  redFg: [121, 31, 31] as [number, number, number], // #791F1F
  white: [255, 255, 255] as [number, number, number],
  /** .p-mark background: rgba(255,255,255,.08) on ink-900 */
  markBg: [31, 31, 30] as [number, number, number],
  /** .p-meta-val — white @ 70% on ink-900 */
  metaVal: [182, 182, 181] as [number, number, number]
} as const;

const STATUS_MAP: Record<
  AttendanceStatus,
  { sym: string; label: string; bg: [number, number, number]; fg: [number, number, number] }
> = {
  present: { sym: "✓", label: "Present", bg: B.greenBg, fg: B.greenFg },
  done: { sym: "✓", label: "Done", bg: B.greenBg, fg: B.greenFg },
  pending: { sym: "~", label: "Pending", bg: B.amberBg, fg: B.amberFg },
  invited: { sym: "~", label: "Invited", bg: B.amberBg, fg: B.amberFg },
  excused: { sym: "~", label: "Excused", bg: B.amberBg, fg: B.amberFg },
  absent: { sym: "✗", label: "Absent", bg: B.redBg, fg: B.redFg },
  cancelled: { sym: "✗", label: "Cancelled", bg: B.redBg, fg: B.redFg },
  /** Template uses en-dash (U+2013) */
  open: { sym: "–", label: "Open", bg: B.ink100, fg: B.ink400 }
};

const STATUS_LABEL_DE: Record<AttendanceStatus, string> = {
  present: "Anwesend",
  done: "Erledigt",
  pending: "Ausstehend",
  invited: "Eingeladen",
  excused: "Entschuldigt",
  absent: "Abwesend",
  cancelled: "Abgesagt",
  open: "Offen"
};

function statusLabelForPdf(status: AttendanceStatus, loc: "de" | "en") {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.open;
  const label = loc === "de" ? STATUS_LABEL_DE[status] ?? cfg.label : cfg.label;
  return { ...cfg, label };
}

/** ✓ / ✗ render poorly in standard PDF fonts; draw strokes like the browser chip. */
function drawStatusSymbolVector(
  doc: jsPDF,
  sym: string,
  left: number,
  centerY: number,
  fg: [number, number, number]
) {
  doc.setDrawColor(fg[0], fg[1], fg[2]);
  doc.setLineWidth(0.42);
  doc.setLineCap("round");
  doc.setLineJoin("round");
  if (sym === "✓") {
    doc.line(left, centerY + 0.35, left + 0.9, centerY + 1.15);
    doc.line(left + 0.9, centerY + 1.15, left + 2.6, centerY - 0.85);
  } else if (sym === "✗") {
    doc.line(left, centerY - 0.4, left + 2.4, centerY + 1.6);
    doc.line(left + 2.4, centerY - 0.4, left, centerY + 1.6);
  }
  doc.setLineCap("butt");
  doc.setLineJoin("miter");
}

function statusSymbolWidthMm(sym: string): number {
  if (sym === "✓" || sym === "✗") return 3.0;
  return 2.2;
}

const PUSHPIN_MM = 4;

async function drawPushpinVector(doc: jsPDF, x: number, y: number, sizeMm: number): Promise<void> {
  if (typeof DOMParser === "undefined") return;
  const parsed = new DOMParser().parseFromString(PUSHPIN_SVG, "image/svg+xml");
  if (parsed.getElementsByTagName("parsererror").length > 0) return;
  const el = parsed.documentElement;
  await svg2pdf(el, doc, { x, y, width: sizeMm, height: sizeMm });
}

/** Legend pills: same pattern as HTML — `sym` + space + rest (template `.p-pill`). Font 8px. */
function drawLegendChip(
  doc: jsPDF,
  x: number,
  yTop: number,
  sym: string,
  rest: string,
  bg: [number, number, number],
  fg: [number, number, number],
  border?: boolean
): number {
  const h = 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  const restW = doc.getTextWidth(rest);
  const gap = 1.1;
  const symW =
    sym === "✓" || sym === "✗" ? statusSymbolWidthMm(sym) : doc.getTextWidth(sym);
  const tw = 5 + symW + gap + restW + 3;
  rgb(doc, bg);
  doc.roundedRect(x, yTop, tw, h, 3, 3, "F");
  if (border) {
    doc.setDrawColor(B.ink200[0], B.ink200[1], B.ink200[2]);
    doc.setLineWidth(0.35);
    doc.roundedRect(x, yTop, tw, h, 3, 3, "S");
  }
  const midY = yTop + h / 2;
  const symLeft = x + 2.2;
  const baseline = yTop + 4.2;
  if (sym === "✓" || sym === "✗") {
    drawStatusSymbolVector(doc, sym, symLeft, midY, fg);
  } else {
    setTextColor(doc, fg);
    doc.text(sym, symLeft, baseline);
  }
  setTextColor(doc, fg);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(rest, symLeft + symW + gap, baseline);
  return tw;
}

const A4 = { w: 210, h: 297 };
/** .p-header / .p-body / .p-legend / .p-footer horizontal padding */
const PAD_H = 7;
const MARGIN = { l: PAD_H, r: PAD_H, t: 0, b: 7 };
const CW = A4.w - MARGIN.l - MARGIN.r;

const STRIPE_H = 2.5;
const HEADER_PAD_TOP = 5;
const HEADER_PAD_BOTTOM = 5;
const BLUE_BAR_H = 1.8;
const LEGEND_PAD_V = 3;
const BODY_PAD_TOP = 4;

/** 28px @ 96dpi → mm */
const MARK_MM = (28 * 25.4) / 96;
const MARK_GAP_MM = (2.5 * 25.4) / 96;
const QS = (MARK_MM - MARK_GAP_MM) / 2;

function rgb(doc: jsPDF, color: [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function setTextColor(doc: jsPDF, color: [number, number, number]) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function localeTag(loc: "de" | "en"): string {
  return loc === "de" ? "de-DE" : "en-GB";
}

/** Matches template fmtDate: en-GB, T00:00:00 */
function fmtDate(iso: string, loc: "de" | "en"): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(localeTag(loc), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

/** Template fmtPeriod: en-dash between dates */
function fmtPeriod(from: string | undefined, to: string | undefined, loc: "de" | "en"): string {
  if (!from || !to) return "—";
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  const a = new Date(from + "T00:00:00").toLocaleDateString(localeTag(loc), opts);
  const b = new Date(to + "T00:00:00").toLocaleDateString(localeTag(loc), opts);
  return `${a} – ${b}`;
}

/** Template exportNow() */
function exportTimestamp(loc: "de" | "en"): string {
  const n = new Date();
  if (loc === "de") {
    return (
      n.toLocaleDateString("de-DE", { dateStyle: "medium" }) +
      ", " +
      n.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    );
  }
  return (
    n.toLocaleDateString("en-GB") + ", " + n.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
}

interface PageState {
  currentPage: number;
  totalPages: number;
  y: number;
}

/**
 * Footer block — matches .p-footer (flow after body, full width, border-top).
 * Template: Page ${n} / ${total} with monospace on the right.
 */
function drawFooterFlow(
  doc: jsPDF,
  state: PageState,
  pageNum: number,
  totalPages: number,
  loc: "de" | "en"
): void {
  const fh = 7;
  const fy = state.y;

  doc.setDrawColor(B.ink200[0], B.ink200[1], B.ink200[2]);
  doc.setLineWidth(0.35);
  doc.line(0, fy, A4.w, fy);

  rgb(doc, B.ink100);
  doc.rect(0, fy, A4.w, fh, "F");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  setTextColor(doc, B.blue600);
  doc.text("OrgFlow", MARGIN.l, fy + 4.5);

  doc.setFont("helvetica", "normal");
  setTextColor(doc, B.ink400);
  const suffix = loc === "de" ? "· Anwesenheitsbericht" : "· Attendance Report";
  doc.text(suffix, MARGIN.l + 14, fy + 4.5);

  doc.setFont("courier", "normal");
  setTextColor(doc, B.ink400);
  const pageLine = `Page ${pageNum} / ${totalPages}`;
  doc.text(pageLine, A4.w - MARGIN.r, fy + 4.5, { align: "right" });

  state.y = fy + fh;
}

function drawHeader(
  doc: jsPDF,
  opts: AttendanceExportOptions,
  pageNum: number,
  totalPages: number,
  loc: "de" | "en"
): number {
  let y = STRIPE_H;

  rgb(doc, B.blue600);
  doc.rect(0, 0, A4.w, STRIPE_H, "F");

  const headerH = 42;
  rgb(doc, B.ink900);
  doc.rect(0, STRIPE_H, A4.w, headerH, "F");

  const innerTop = STRIPE_H + HEADER_PAD_TOP;
  const mx = MARGIN.l;
  const my = innerTop;

  rgb(doc, B.markBg);
  doc.roundedRect(mx, my, MARK_MM, MARK_MM, 1.75, 1.75, "F");

  const qg = MARK_GAP_MM;
  const quadPos: [number, number][] = [
    [mx, my],
    [mx + QS + qg, my],
    [mx, my + QS + qg],
    [mx + QS + qg, my + QS + qg]
  ];
  const quadAlpha = [1, 0.5, 0.5, 0.25];
  quadPos.forEach(([qx, qy], i) => {
    const v = Math.round(255 * quadAlpha[i]!);
    doc.setFillColor(v, v, v);
    doc.roundedRect(qx, qy, QS, QS, 0.5, 0.5, "F");
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setTextColor(doc, B.white);
  doc.text("OrgFlow", mx + MARK_MM + 2.5, my + QS + 1);

  const title =
    loc === "de" ? "Anwesenheitsbericht" : "Attendance Report";
  doc.setFontSize(15);
  doc.text(title, mx, my + MARK_MM + 3 + 5);

  doc.setFontSize(6.8);
  doc.setFont("helvetica", "normal");
  setTextColor(doc, B.ink400);
  const sub =
    loc === "de" ? "Schicht-Anwesenheit & Bestätigung" : "Shift attendance & sign-off";
  doc.text(sub, mx, my + MARK_MM + 3 + 11);

  const rx = A4.w - MARGIN.r;
  const eventLine = opts.event_title?.trim() || "—";
  const orgLabel = loc === "de" ? "Organisation" : "Organisation";
  const eventLabel = loc === "de" ? "Veranstaltung" : "Event";
  const periodLabel = loc === "de" ? "Zeitraum" : "Period";
  const exportedLabel = loc === "de" ? "Exportiert" : "Exported";
  const pageLabel = loc === "de" ? "Seite" : "Page";
  const pageOf = loc === "de" ? "von" : "of";

  const metaLines: [string, string][] = [
    [`${orgLabel}: `, opts.organisation],
    [`${eventLabel}: `, eventLine],
    [`${periodLabel}: `, fmtPeriod(opts.period_from, opts.period_to, loc)],
    [`${exportedLabel}: `, exportTimestamp(loc)],
    [`${pageLabel}: `, `${pageNum} ${pageOf} ${totalPages}`]
  ];

  doc.setFontSize(8);
  metaLines.forEach(([label, value], i) => {
    const ly = innerTop + 2 + i * 2.8;
    doc.setFont("helvetica", "normal");
    const w1 = doc.getTextWidth(label);
    const w2 = doc.getTextWidth(value);
    const totalW = w1 + w2;
    let x = rx - totalW;
    setTextColor(doc, B.ink400);
    doc.text(label, x, ly);
    x += w1;
    setTextColor(doc, B.metaVal);
    doc.text(value, x, ly);
  });

  y = STRIPE_H + headerH;

  rgb(doc, B.blue600);
  doc.rect(0, y, A4.w, BLUE_BAR_H, "F");
  y += BLUE_BAR_H;

  rgb(doc, B.ink50);
  const legendH = LEGEND_PAD_V * 2 + 6;
  doc.rect(0, y, A4.w, legendH, "F");

  const legendItems: {
    sym: string;
    rest: string;
    bg: [number, number, number];
    fg: [number, number, number];
    border?: boolean;
  }[] =
    loc === "de"
      ? [
          { sym: "✓", rest: "Anwesend / Erledigt", bg: B.greenBg, fg: B.greenFg },
          { sym: "~", rest: "Ausstehend / Eingeladen", bg: B.amberBg, fg: B.amberFg },
          { sym: "✗", rest: "Abwesend / Abgesagt", bg: B.redBg, fg: B.redFg },
          { sym: "\u2013", rest: "Offener Platz", bg: B.ink100, fg: B.ink400, border: true }
        ]
      : [
          { sym: "✓", rest: "Present / Done", bg: B.greenBg, fg: B.greenFg },
          { sym: "~", rest: "Pending / Invited", bg: B.amberBg, fg: B.amberFg },
          { sym: "✗", rest: "Absent / Cancelled", bg: B.redBg, fg: B.redFg },
          { sym: "\u2013", rest: "Open slot", bg: B.ink100, fg: B.ink400, border: true }
        ];

  let lx = MARGIN.l + 1;
  const ly0 = y + LEGEND_PAD_V;
  legendItems.forEach((item) => {
    const tw = drawLegendChip(doc, lx, ly0, item.sym, item.rest, item.bg, item.fg, item.border);
    lx += tw + 1.1;
  });

  doc.setDrawColor(B.ink200[0], B.ink200[1], B.ink200[2]);
  doc.setLineWidth(0.35);
  doc.line(0, y + legendH, A4.w, y + legendH);

  return y + legendH + BODY_PAD_TOP;
}

function ensureSpace(doc: jsPDF, state: PageState, needed: number, opts: AttendanceExportOptions, loc: "de" | "en") {
  const reserveFooter = 12;
  const maxY = A4.h - MARGIN.b - reserveFooter;
  if (state.y + needed > maxY) {
    doc.addPage();
    state.currentPage = doc.getNumberOfPages();
    state.y = drawHeader(doc, opts, state.currentPage, state.totalPages, loc);
  }
}

function drawDayBanner(
  doc: jsPDF,
  state: PageState,
  dateStr: string,
  opts: AttendanceExportOptions,
  loc: "de" | "en"
) {
  ensureSpace(doc, state, 12, opts, loc);

  rgb(doc, B.blue600);
  doc.roundedRect(MARGIN.l, state.y, CW, 8, 1, 1, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  setTextColor(doc, B.white);
  doc.text(dateStr, MARGIN.l + 4, state.y + 5.2);
  state.y += 8 + 2.5;
}

async function drawShiftHeader(
  doc: jsPDF,
  state: PageState,
  shift: AttendanceShift,
  filled: number,
  total: number,
  opts: AttendanceExportOptions,
  loc: "de" | "en"
) {
  ensureSpace(doc, state, 12, opts, loc);

  rgb(doc, B.ink100);
  doc.roundedRect(MARGIN.l, state.y, CW, 9, 1, 1, "F");

  rgb(doc, B.blue600);
  doc.rect(MARGIN.l, state.y, 1.5, 9, "F");

  doc.setFont("courier", "bold");
  doc.setFontSize(8.5);
  setTextColor(doc, B.blue600);
  doc.text(`${shift.time_from} \u2013 ${shift.time_to}`, MARGIN.l + 4, state.y + 6);

  doc.setFont("helvetica", "bold");
  setTextColor(doc, B.ink900);
  doc.text(shift.title, MARGIN.l + 34, state.y + 6);

  if (shift.location) {
    const locX = MARGIN.l + 100;
    const pinTop = state.y + (9 - PUSHPIN_MM) / 2;
    await drawPushpinVector(doc, locX, pinTop, PUSHPIN_MM);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setTextColor(doc, B.ink400);
    const textX = locX + PUSHPIN_MM + 1.2;
    const maxLocW = Math.max(12, MARGIN.l + CW - textX - 42);
    doc.text(shift.location, textX, state.y + 6, { maxWidth: maxLocW });
  }

  const pct = total > 0 ? filled / total : 0;
  const pillBg = pct >= 1 ? B.greenBg : pct >= 0.5 ? B.amberBg : B.redBg;
  const pillFg = pct >= 1 ? B.greenFg : pct >= 0.5 ? B.amberFg : B.redFg;
  const filledLabel = loc === "de" ? "belegt" : "filled";
  const pillLabel = `${filled}/${total} ${filledLabel}`;
  const pillW = doc.getTextWidth(pillLabel) + 6;
  rgb(doc, pillBg);
  doc.roundedRect(MARGIN.l + CW - pillW - 2, state.y + 1.5, pillW, 6, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setTextColor(doc, pillFg);
  doc.text(pillLabel, MARGIN.l + CW - pillW / 2 - 2, state.y + 5.8, { align: "center" });

  state.y += 9;
}

function drawPersonTable(
  doc: jsPDF,
  state: PageState,
  shift: AttendanceShift,
  opts: AttendanceExportOptions,
  loc: "de" | "en"
) {
  const nameCol = loc === "de" ? "Name" : "Name";
  const roleCol = loc === "de" ? "Rolle" : "Role";
  const statusCol = "Status";
  const checkCol = "Check-in";

  const rows = shift.persons.map((p) => {
    const nameCell =
      p.status === "open"
        ? loc === "de"
          ? "Freier Platz"
          : "Open slot"
        : p.name || "—";
    const roleCell = p.role?.trim() || "—";
    const checkCell = p.checkin_time ?? "—";
    return [nameCell, roleCell, "\u00a0", checkCell];
  });

  autoTable(doc, {
    startY: state.y,
    margin: { left: MARGIN.l, right: MARGIN.r },
    tableWidth: CW,
    head: [[nameCol, roleCol, statusCol, checkCol]],
    body: rows,
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      textColor: B.ink600,
      lineColor: B.ink200,
      lineWidth: 0.12
    },
    headStyles: {
      fillColor: B.ink900,
      textColor: B.white,
      fontStyle: "bold",
      fontSize: 7.5,
      lineColor: B.blue800,
      lineWidth: 0.4
    },
    alternateRowStyles: {
      fillColor: B.ink100
    },
    bodyStyles: {
      fillColor: B.ink50
    },
    columnStyles: {
      0: { cellWidth: CW * 0.35, fontStyle: "bold", textColor: B.ink900 },
      1: { cellWidth: CW * 0.2, textColor: B.ink400 },
      2: { cellWidth: CW * 0.22 },
      3: { cellWidth: CW * 0.23, font: "courier", fontSize: 7.5 }
    },
    willDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 2) {
        data.cell.text = [];
      }
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        const p = shift.persons[data.row.index];
        if (p?.status === "open") {
          data.cell.styles.fontStyle = "italic";
          data.cell.styles.textColor = B.ink400;
        }
      }
      if (data.section === "body" && data.column.index === 2) {
        const rowBg = data.row.index % 2 === 0 ? B.ink50 : B.ink100;
        data.cell.styles.fillColor = rowBg;
        data.cell.styles.textColor = rowBg;
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 2) return;
      const p = shift.persons[data.row.index];
      if (!p) return;
      const cfg = statusLabelForPdf(p.status, loc);
      const cell = data.cell;
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      const labelW = doc.getTextWidth(cfg.label);
      const gap = 1.1;
      const symW =
        cfg.sym === "✓" || cfg.sym === "✗" ? statusSymbolWidthMm(cfg.sym) : doc.getTextWidth(cfg.sym);
      const innerPad = 5;
      const pillW = Math.min(innerPad + symW + gap + labelW + 3, cell.width - 4);
      const h = 6;
      const px = cell.x + 2;
      const py = cell.y + (cell.height - h) / 2;
      doc.setFillColor(cfg.bg[0], cfg.bg[1], cfg.bg[2]);
      doc.roundedRect(px, py, pillW, h, 3, 3, "F");
      if (p.status === "open") {
        doc.setDrawColor(B.ink200[0], B.ink200[1], B.ink200[2]);
        doc.setLineWidth(0.35);
        doc.roundedRect(px, py, pillW, h, 3, 3, "S");
      }
      const midY = py + h / 2;
      const symLeft = px + 2.2;
      if (cfg.sym === "✓" || cfg.sym === "✗") {
        drawStatusSymbolVector(doc, cfg.sym, symLeft, midY, cfg.fg);
      } else {
        setTextColor(doc, cfg.fg);
        doc.text(cfg.sym, symLeft, py + 4.25);
      }
      const labelX = symLeft + symW + gap;
      setTextColor(doc, cfg.fg);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text(cfg.label, labelX, py + 4.25);
    },
    didDrawPage: () => {
      const n = doc.getNumberOfPages();
      if (n > state.currentPage) {
        state.currentPage = n;
      }
    }
  });

  const last = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  state.y = (last?.finalY ?? state.y) + 3;
}

function drawSignature(doc: jsPDF, state: PageState, opts: AttendanceExportOptions, loc: "de" | "en") {
  state.y += 3;
  ensureSpace(doc, state, 24, opts, loc);

  rgb(doc, B.ink100);
  doc.roundedRect(MARGIN.l, state.y, CW, 18, 1, 1, "F");

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  setTextColor(doc, B.ink400);
  const conf =
    loc === "de" ? "Bestätigt durch Teamleitung / Organisation" : "Confirmed by team lead / organiser";
  doc.text(conf, MARGIN.l + 4, state.y + 5);

  doc.setDrawColor(B.ink200[0], B.ink200[1], B.ink200[2]);
  doc.setLineWidth(0.35);
  doc.line(MARGIN.l + 4, state.y + 14, MARGIN.l + CW * 0.52, state.y + 14);
  doc.setFontSize(7);
  const sigCap = loc === "de" ? "Unterschrift & Name" : "Signature & Name";
  doc.text(sigCap, MARGIN.l + 4 + (CW * 0.52 - 4) / 2, state.y + 17, { align: "center" });

  doc.setDrawColor(B.ink200[0], B.ink200[1], B.ink200[2]);
  doc.line(MARGIN.l + CW * 0.56, state.y + 3, MARGIN.l + CW * 0.56, state.y + 15);

  doc.line(MARGIN.l + CW * 0.6, state.y + 14, MARGIN.l + CW - 4, state.y + 14);
  const dtLabel = loc === "de" ? "Datum & Uhrzeit" : "Date & time";
  doc.text(dtLabel, MARGIN.l + CW * 0.6, state.y + 5);
  const dateCap = loc === "de" ? "Datum" : "Date";
  doc.text(dateCap, MARGIN.l + CW * 0.6 + (CW * 0.4 - 4) / 2, state.y + 17, { align: "center" });

  state.y += 18 + 1;
}

export async function generateAttendancePdf(opts: AttendanceExportOptions): Promise<void> {
  const loc = opts.locale === "de" ? "de" : "en";
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const totalPages = Math.max(1, opts.days.length);

  const state: PageState = { currentPage: 1, totalPages, y: 0 };

  for (let dayIndex = 0; dayIndex < opts.days.length; dayIndex++) {
    const day = opts.days[dayIndex];
    if (dayIndex > 0) {
      doc.addPage();
      state.currentPage = doc.getNumberOfPages();
    }

    state.y = drawHeader(doc, opts, state.currentPage, totalPages, loc);

    const dayLabel = day.date
      ? fmtDate(day.date, loc)
      : loc === "de"
        ? "Kein Datum"
        : "No date set";

    drawDayBanner(doc, state, dayLabel, opts, loc);

    for (const group of day.event_groups) {
      ensureSpace(doc, state, 8, opts, loc);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      setTextColor(doc, B.ink600);
      doc.text(group.name, MARGIN.l + 1.5, state.y + 3.5);
      state.y += 6;

      for (const shift of group.shifts) {
        const filled = shift.persons.filter((p) => p.status !== "open").length;
        const total = shift.persons.length;
        await drawShiftHeader(doc, state, shift, filled, total, opts, loc);
        drawPersonTable(doc, state, shift, opts, loc);
      }
    }

    drawSignature(doc, state, opts, loc);
    drawFooterFlow(doc, state, state.currentPage, totalPages, loc);
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const safeName = (opts.event_title ?? (loc === "de" ? "Anwesenheit" : "Attendance"))
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase()
    .slice(0, 48);
  doc.save(`orgflow_attendance_${safeName}_${dateStr}.pdf`);
}

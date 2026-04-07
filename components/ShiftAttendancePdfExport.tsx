"use client";

import { useMemo } from "react";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";
import { buildAttendanceExportData } from "../lib/pdf/attendance-adapter";
import type { ShiftForPdf } from "../lib/shiftForPdf";
import { ExportAttendanceButton } from "./shifts/ExportAttendanceButton";

export type { ShiftForPdf } from "../lib/shiftForPdf";

type Props = {
  shifts: ShiftForPdf[];
  profileNames: Record<string, string>;
  /** `profiles.role` per user id (organisation role: Member, Admin, Lead, …). */
  profileRoles?: Record<string, string | null | undefined>;
  /** Kept for call-site compatibility (not required for client-side jsPDF export). */
  organizationId?: string;
  buttonClassName?: string;
  organizationName?: string;
  organizationSlug?: string;
};

function deriveDateRange(shifts: ShiftForPdf[]): { start: string; end: string } {
  const ds = shifts
    .map((s) => String(s.date ?? "").slice(0, 10))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  if (ds.length === 0) return { start: "1970-01-01", end: "2099-12-31" };
  return { start: ds[0]!, end: ds[ds.length - 1]! };
}

/**
 * Generates the attendance PDF in the browser (jsPDF + autoTable).
 */
export default function ShiftAttendancePdfExport({
  shifts,
  profileNames,
  profileRoles,
  buttonClassName,
  organizationName,
  organizationSlug
}: Props) {
  const { locale } = useLocale();
  const loc = locale === "de" ? "de" : "en";

  const pdfData = useMemo(() => {
    const orgLabel =
      (organizationName ?? "").trim() ||
      (organizationSlug ?? "").trim() ||
      "—";
    const { start, end } = deriveDateRange(shifts);
    return buildAttendanceExportData({
      organisationName: orgLabel,
      shifts,
      profileNames,
      profileRoles,
      periodFrom: start,
      periodTo: end,
      locale: loc
    });
  }, [shifts, profileNames, profileRoles, organizationName, organizationSlug, loc]);

  if (!shifts || shifts.length === 0) return null;
  if (pdfData.days.length === 0) return null;

  return (
    <ExportAttendanceButton
      data={pdfData}
      className={buttonClassName}
      exportLabel={t("shifts.export_attendance_pdf", locale)}
      loadingLabel={t("shifts.export_attendance_pdf_generating", locale)}
      aria-label={t("shifts.export_attendance_pdf", locale)}
    />
  );
}

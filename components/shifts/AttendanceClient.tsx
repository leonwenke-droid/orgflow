"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "../LocaleProvider";
import { t } from "../../lib/i18n";
import { confirmAttendanceManual } from "../../lib/actions/shifts";
import type { ShiftForPdf } from "../ShiftAttendancePdfExport";

type AssignmentRow = NonNullable<ShiftForPdf["shift_assignments"]>[number];

export default function AttendanceClient({
  assignments,
  orgSlug,
  profileNames
}: {
  assignments: AssignmentRow[];
  orgSlug: string;
  profileNames: Record<string, string>;
}) {
  const { locale } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleConfirm = (assignmentId: string, status: "present" | "absent" | "excused") => {
    startTransition(async () => {
      await confirmAttendanceManual(assignmentId, orgSlug, status);
      router.refresh();
    });
  };

  const present = assignments.filter((a) => !!a.checked_in_at || a.status === "erledigt").length;
  const absent = assignments.filter((a) => a.status === "abgesagt").length;
  const pendingCount = assignments.filter(
    (a) => !a.checked_in_at && a.status !== "erledigt" && a.status !== "abgesagt"
  ).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border-subtle bg-bg-secondary p-3 dark:border-border-default">
          <div className="text-[11px] text-text-muted">{t("shifts.attendance.status.present", locale)}</div>
          <div className="text-[20px] font-medium text-green-700 dark:text-green-300">{present}</div>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-secondary p-3 dark:border-border-default">
          <div className="text-[11px] text-text-muted">{t("shifts.attendance.status.registered", locale)}</div>
          <div className="text-[20px] font-medium text-amber-700 dark:text-amber-300">{pendingCount}</div>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-secondary p-3 dark:border-border-default">
          <div className="text-[11px] text-text-muted">{t("shifts.attendance.status.absent", locale)}</div>
          <div className="text-[20px] font-medium text-red-700 dark:text-red-300">{absent}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-primary dark:border-border-default">
        {assignments.map((assignment) => (
          <div
            key={assignment.id}
            className="flex flex-wrap items-center gap-3 border-b border-border-subtle p-3 last:border-0 dark:border-border-default"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="text-[13px] font-medium text-text-primary">
                {profileNames[assignment.user_id] ?? "—"}
              </span>
              <span className="text-[11px] text-text-muted">
                {assignment.checked_in_at
                  ? `${new Date(assignment.checked_in_at).toLocaleTimeString(locale === "de" ? "de-DE" : "en-GB", { hour: "2-digit", minute: "2-digit" })}`
                  : "—"}
              </span>
            </div>
            {assignment.status !== "erledigt" && assignment.status !== "abgesagt" ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-md border border-[var(--color-success)]/30 bg-[var(--bg-success-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-success-text)]"
                  onClick={() => handleConfirm(assignment.id, "present")}
                >
                  {t("shifts.attendance.confirm_present", locale)}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
                  onClick={() => handleConfirm(assignment.id, "absent")}
                >
                  {t("shifts.attendance.confirm_absent", locale)}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-md border border-border-subtle px-2.5 py-1 text-[11px] font-medium text-text-secondary dark:border-border-default"
                  onClick={() => handleConfirm(assignment.id, "excused")}
                >
                  {t("shifts.attendance.status.excused", locale)}
                </button>
              </div>
            ) : (
              <span className="text-[11px] text-text-muted">{assignment.status}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

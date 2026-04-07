"use client";

import { useState } from "react";
import type { ShiftForPdf } from "../ShiftAttendancePdfExport";
import ShiftCalendarMatrix from "./ShiftCalendarMatrix";
import ShiftCalendarDetailDrawer from "./ShiftCalendarDetailDrawer";

export default function ShiftsCalendarPanel({
  shifts,
  todayStr,
  profileNames
}: {
  shifts: ShiftForPdf[];
  todayStr: string;
  profileNames: Record<string, string>;
}) {
  const [detail, setDetail] = useState<ShiftForPdf | null>(null);

  return (
    <>
      <ShiftCalendarMatrix
        shifts={shifts}
        todayStr={todayStr}
        showWeekNav
        onOpenShiftDetail={setDetail}
      />
      {detail ? (
        <ShiftCalendarDetailDrawer shift={detail} profileNames={profileNames} onClose={() => setDetail(null)} />
      ) : null}
    </>
  );
}

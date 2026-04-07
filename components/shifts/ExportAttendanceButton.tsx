"use client";

import { useState } from "react";
import { generateAttendancePdf } from "../../lib/pdf/attendance-pdf";
import type { AttendanceExportOptions } from "../../lib/pdf/attendance-types";

interface Props {
  /** Pass the fully-shaped export data from your page/hook */
  data: AttendanceExportOptions;
  /** Optional: show as icon-only button */
  compact?: boolean;
  className?: string;
  /** Visible label (i18n from parent) */
  exportLabel?: string;
  loadingLabel?: string;
  "aria-label"?: string;
}

export function ExportAttendanceButton({
  data,
  compact = false,
  className,
  exportLabel = "Export PDF",
  loadingLabel = "Generating…",
  "aria-label": ariaLabel
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      await generateAttendancePdf(data);
    } finally {
      setLoading(false);
    }
  };

  const mergedClass = className
    ? [
        "inline-flex items-center gap-2 font-medium transition-all",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        compact ? "px-3 py-2 text-sm" : "px-4 py-2.5 text-sm",
        className
      ]
        .filter(Boolean)
        .join(" ")
    : [
        "inline-flex items-center gap-2 rounded-[10px] font-medium transition-all",
        "bg-[#185FA5] text-white hover:bg-[#0C447C] disabled:opacity-60 disabled:cursor-not-allowed",
        compact ? "px-3 py-2 text-sm" : "px-4 py-2.5 text-sm"
      ].join(" ");

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className={mergedClass}
      aria-label={ariaLabel ?? exportLabel}
    >
      {loading ? (
        <>
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
            />
          </svg>
          {!compact && <span>{loadingLabel}</span>}
        </>
      ) : (
        <>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M8 1v9M4 6l4 4 4-4" />
            <rect x="1" y="11" width="14" height="4" rx="1.5" />
          </svg>
          {!compact && <span>{exportLabel}</span>}
        </>
      )}
    </button>
  );
}

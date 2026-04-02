"use client";

import { useLocale } from "../LocaleProvider";
import type { Locale } from "../../lib/i18n";
import { formatShiftSlotsLabel } from "../../lib/i18n";
import { shiftSlotDotClass } from "../../lib/formatters";

export interface ShiftAvailabilityProps {
  free: number;
  required: number;
  /** When set (e.g. from server cookie), overrides client locale. */
  locale?: Locale;
  className?: string;
  /** Classes for the slot label (default matches body text). */
  textClassName?: string;
}

/**
 * Traffic-light dot + localized “X of Y free” label for shift slot availability.
 */
export function ShiftAvailability({
  free,
  required,
  locale: localeProp,
  className = "",
  textClassName = "text-sm text-text-secondary dark:text-text-secondary"
}: ShiftAvailabilityProps) {
  const { locale: ctxLocale } = useLocale();
  const locale = localeProp ?? ctxLocale;
  const label = formatShiftSlotsLabel(locale, free, required);
  const dotClass = shiftSlotDotClass(free, required);

  return (
    <span className={`inline-flex items-center gap-2 ${className}`} title={label}>
      <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
      <span className={textClassName}>{label}</span>
    </span>
  );
}

/**
 * Format amount as EUR with German locale (e.g. 312209.5 → "312.209,50").
 * Always shows 2 decimal places (cents) with comma.
 */
export function formatCurrency(amount: number, locale = "de-DE"): string {
  return Number(amount).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

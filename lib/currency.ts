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

/**
 * Parse user input for treasury amount. Accepts both:
 * - German: 2636,99 or 2.636,99 (comma = decimal)
 * - English: 2636.99 or 2,636.99 (dot = decimal)
 */
export function parseTreasuryAmount(input: string): number {
  const s = input.trim().replace(/\s/g, "");
  if (!s) return NaN;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  const afterComma = lastComma >= 0 ? s.slice(lastComma + 1) : "";
  const afterDot = lastDot >= 0 ? s.slice(lastDot + 1) : "";
  const centsLike = /^\d{1,3}$/;
  if (lastComma > lastDot && centsLike.test(afterComma)) {
    return Number(s.replace(/\./g, "").replace(",", "."));
  }
  if (lastDot > lastComma && centsLike.test(afterDot)) {
    return Number(s.replace(/,/g, ""));
  }
  return Number(s.replace(/\./g, "").replace(",", "."));
}

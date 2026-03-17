/**
 * Format amount with optional currency. Uses locale for number format.
 * currencyCode: ISO 4217 (e.g. EUR, USD). If omitted, no currency symbol.
 */
export function formatCurrency(
  amount: number,
  locale = "de-DE",
  currencyCode?: string
): string {
  const options: Intl.NumberFormatOptions = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  };
  if (currencyCode) {
    options.style = "currency";
    options.currency = currencyCode;
  }
  return Number(amount).toLocaleString(locale, options);
}

/** Default currency for display when org has none set. */
export const DEFAULT_CURRENCY = "EUR";

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

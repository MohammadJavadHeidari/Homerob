const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Convert Latin digits in a string/number to Persian digits. */
export function toFaDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/** Convert Persian and Arabic-Indic digits to Latin digits (for parsing). */
export function toEnDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
}

/** Format a number with Persian digits and thousands separators (e.g. ۱٬۲۰۰٬۰۰۰). */
export function formatFaNumber(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(value);
}

/**
 * Human-friendly Toman amount: 500_000_000 → "۵۰۰ میلیون", 1_200_000_000 → "۱٫۲ میلیارد".
 */
export function formatToman(value: number): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(n);
  if (value >= 1_000_000_000) return `${fmt(value / 1_000_000_000)} میلیارد`;
  if (value >= 1_000_000) return `${fmt(value / 1_000_000)} میلیون`;
  if (value >= 1_000) return `${fmt(value / 1_000)} هزار`;
  return fmt(value);
}

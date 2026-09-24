import { toEnDigits } from "./persian";

/**
 * Normalize Persian text for matching: Arabic ي/ك → Persian ی/ک, digits → Latin,
 * ZWNJ and extra spaces collapsed to a single space.
 */
export function normalizeFa(input: string): string {
  return toEnDigits(input)
    .replace(/ي/g, "ی")
    .replace(/ى/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ة/g, "ه")
    .replace(/[‌‏‎]/g, " ")
    .replace(/[٬,]/g, ",")
    .replace(/٫/g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

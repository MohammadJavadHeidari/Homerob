/**
 * Rahn ↔ ejare price normalization.
 *
 * Market convention in Iran: each 1,000,000 Toman of deposit is worth ~30,000 Toman of
 * monthly rent (3% per month). Change the rate here to re-tune every comparison.
 */
export const MONTHLY_RATE = 0.03;

export interface PriceLike {
  deposit: number;
  monthlyRent: number;
}

/** Deposit you'd need if the whole price were paid as rahn (no rent). */
export function toFullDeposit(p: PriceLike, rate = MONTHLY_RATE): number {
  return Math.round(p.deposit + p.monthlyRent / rate);
}

/** Monthly rent you'd pay if the whole price were paid as ejare (no deposit). */
export function toFullRent(p: PriceLike, rate = MONTHLY_RATE): number {
  return Math.round(p.monthlyRent + p.deposit * rate);
}

/**
 * Monthly rent after re-balancing the price to a different deposit.
 * More deposit → lower rent; less deposit → higher rent. Returns `null` when the deposit
 * exceeds the full-rahn value (rent would go negative).
 */
export function rentAtDeposit(
  p: PriceLike,
  deposit: number,
  rate = MONTHLY_RATE,
): number | null {
  const rent = p.monthlyRent + (p.deposit - deposit) * rate;
  if (rent < 0) return null;
  return Math.round(rent);
}

/** Deposit needed to bring the monthly rent down to `rent` (inverse of `rentAtDeposit`). */
export function depositAtRent(
  p: PriceLike,
  rent: number,
  rate = MONTHLY_RATE,
): number | null {
  const deposit = p.deposit + (p.monthlyRent - rent) / rate;
  if (deposit < 0) return null;
  return Math.round(deposit);
}

/** Full-deposit price per square meter — the fair "apples to apples" unit price. */
export function pricePerM2(
  p: PriceLike & { areaM2: number },
  rate = MONTHLY_RATE,
): number {
  return Math.round(toFullDeposit(p, rate) / p.areaM2);
}

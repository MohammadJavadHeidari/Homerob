import type { SearchIntent } from "@/lib/intent/schema";
import { MONTHLY_RATE, depositAtRent, rentAtDeposit, toFullDeposit } from "@/lib/pricing";
import type { Listing } from "@/lib/types";

/**
 * When the user states only one side of the budget (only rahn or only ejare), a convertible
 * listing may still fit by shifting money — but only up to this much beyond the stated side.
 * Otherwise every convertible listing would "fit" by paying huge rent.
 */
export const ONE_SIDED_STRETCH = 0.3;

/**
 * With a one-sided budget, the unstated side is capped at this multiple of the stated side's
 * equivalent: "ماهی ۸ تومن" (≈ 267M as deposit) shouldn't surface a 1.4B full-rahn listing.
 */
export const IMPLICIT_FACTOR = 2;

export interface BudgetFit {
  fits: boolean;
  /** Deposit / rent the user would actually pay (after conversion, if any). */
  deposit: number;
  monthlyRent: number;
  /** True when the price split was changed to fit the budget. */
  converted: boolean;
  /** How far under the tightest stated limit (Toman, full-deposit equivalent). Negative = over. */
  headroom: number | null;
}

/** Hard budget check with rahn ↔ ejare conversion when the user and landlord both allow it. */
export function fitBudget(l: Listing, intent: SearchIntent, rate = MONTHLY_RATE): BudgetFit {
  const { maxDeposit: D, maxRent: R } = intent;
  const asListed = { deposit: l.deposit, monthlyRent: l.monthlyRent };
  const canConvert = intent.flexibleConversion && l.convertible;
  const result = (fits: boolean, deposit: number, monthlyRent: number): BudgetFit => {
    const converted = deposit !== l.deposit || monthlyRent !== l.monthlyRent;
    let headroom: number | null = null;
    if (D !== null && R !== null) headroom = D + R / rate - toFullDeposit(asListed, rate);
    else if (D !== null) headroom = D - deposit;
    else if (R !== null) headroom = (R - monthlyRent) / rate;
    return { fits, deposit, monthlyRent, converted, headroom };
  };

  if (D === null && R === null) return result(true, l.deposit, l.monthlyRent);

  // Both sides stated: fits if some split has deposit ≤ D and rent ≤ R.
  if (D !== null && R !== null) {
    if (l.deposit <= D && l.monthlyRent <= R) return result(true, l.deposit, l.monthlyRent);
    if (canConvert) {
      const deposit = Math.min(D, toFullDeposit(asListed, rate));
      const rent = rentAtDeposit(asListed, deposit, rate);
      if (rent !== null && rent <= R) return result(true, deposit, rent);
    }
    return result(false, l.deposit, l.monthlyRent);
  }

  // Only deposit stated.
  if (D !== null) {
    const rentCap = IMPLICIT_FACTOR * D * rate;
    if (l.deposit <= D) return result(l.monthlyRent <= rentCap, l.deposit, l.monthlyRent);
    if (canConvert && l.deposit <= D * (1 + ONE_SIDED_STRETCH)) {
      const rent = rentAtDeposit(asListed, D, rate)!;
      return result(rent <= rentCap, D, rent);
    }
    return result(false, l.deposit, l.monthlyRent);
  }

  // Only rent stated.
  const depositCap = (IMPLICIT_FACTOR * R!) / rate;
  if (l.monthlyRent <= R!) return result(l.deposit <= depositCap, l.deposit, l.monthlyRent);
  if (canConvert && l.monthlyRent <= R! * (1 + ONE_SIDED_STRETCH)) {
    const deposit = depositAtRent(asListed, R!, rate)!;
    return result(deposit <= depositCap, deposit, R!);
  }
  return result(false, l.deposit, l.monthlyRent);
}

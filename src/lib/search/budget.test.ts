import { describe, expect, it } from "vitest";

import { EMPTY_INTENT, type SearchIntent } from "@/lib/intent/schema";
import type { Listing } from "@/lib/types";

import { fitBudget } from "./budget";

const M = 1_000_000;
const listing = (p: Partial<Listing>): Listing => ({
  id: "t", source: "divar", title: "t", city: "مشهد", neighborhood: "وکیل‌آباد", street: "", deposit: 300 * M,
  monthlyRent: 20 * M, areaM2: 90, rooms: 2, floor: 1, totalFloors: 4, buildingAge: 5,
  elevator: true, parking: true, storage: true, tags: [], convertible: true, description: "",
  postedAt: "2026-09-20T00:00:00Z", ...p,
});
const intent = (p: Partial<SearchIntent>): SearchIntent => ({ ...EMPTY_INTENT, ...p });

describe("fitBudget", () => {
  it("fits everything when no budget is given", () => {
    expect(fitBudget(listing({}), intent({})).fits).toBe(true);
  });

  it("fits as listed when under both limits", () => {
    const f = fitBudget(listing({}), intent({ maxDeposit: 400 * M, maxRent: 25 * M }));
    expect(f).toMatchObject({ fits: true, converted: false, deposit: 300 * M, monthlyRent: 20 * M });
  });

  it("converts extra deposit into lower rent when both limits are stated", () => {
    // 300M + 20M; user has 500M but max 15M rent → pay 500M, rent 20 − 6 = 14M
    const f = fitBudget(listing({}), intent({ maxDeposit: 500 * M, maxRent: 15 * M }));
    expect(f).toMatchObject({ fits: true, converted: true, deposit: 500 * M, monthlyRent: 14 * M });
  });

  it("does not convert when the landlord or user refuses", () => {
    const i = intent({ maxDeposit: 500 * M, maxRent: 15 * M });
    expect(fitBudget(listing({ convertible: false }), i).fits).toBe(false);
    expect(fitBudget(listing({}), { ...i, flexibleConversion: false }).fits).toBe(false);
  });

  it("allows a limited stretch when only deposit is stated", () => {
    const i = intent({ maxDeposit: 500 * M });
    // 550M wanted, convertible → pay 500M, rent +1.5M
    const f = fitBudget(listing({ deposit: 550 * M, monthlyRent: 16 * M }), i);
    expect(f).toMatchObject({ fits: true, converted: true, deposit: 500 * M, monthlyRent: 17.5 * M });
    // 900M wanted → too far over, even if convertible
    expect(fitBudget(listing({ deposit: 900 * M }), i).fits).toBe(false);
  });

  it("allows a limited stretch when only rent is stated", () => {
    const f = fitBudget(listing({ deposit: 100 * M, monthlyRent: 12 * M }), intent({ maxRent: 10 * M }));
    // 2M less rent ↔ 66.7M more deposit
    expect(f.fits).toBe(true);
    expect(f.monthlyRent).toBe(10 * M);
    expect(f.deposit).toBe(166_666_667);
  });

  it("caps the unstated side of a one-sided budget", () => {
    // "ماهی ۸ تومن" → deposit cap 2 × 8M / 0.03 ≈ 533M
    expect(fitBudget(listing({ deposit: 1_400 * M, monthlyRent: 0 }), intent({ maxRent: 8 * M })).fits).toBe(false);
    expect(fitBudget(listing({ deposit: 400 * M, monthlyRent: 7 * M }), intent({ maxRent: 8 * M })).fits).toBe(true);
    // "۵۰۰ میلیون رهن" → rent cap 2 × 500M × 0.03 = 30M
    expect(fitBudget(listing({ deposit: 450 * M, monthlyRent: 18 * M }), intent({ maxDeposit: 500 * M })).fits).toBe(true);
    expect(fitBudget(listing({ deposit: 500 * M, monthlyRent: 35 * M }), intent({ maxDeposit: 500 * M })).fits).toBe(false);
  });

  it("reports headroom", () => {
    expect(fitBudget(listing({ deposit: 450 * M }), intent({ maxDeposit: 500 * M })).headroom).toBe(50 * M);
  });
});

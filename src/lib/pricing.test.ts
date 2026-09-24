import { describe, expect, it } from "vitest";

import {
  MONTHLY_RATE,
  depositAtRent,
  pricePerM2,
  rentAtDeposit,
  toFullDeposit,
  toFullRent,
} from "./pricing";

const M = 1_000_000;

describe("pricing normalization", () => {
  it("uses the 3% monthly market convention", () => {
    expect(MONTHLY_RATE).toBe(0.03);
  });

  it("converts rent into equivalent deposit", () => {
    // 300M rahn + 15M ejare → 300M + 15M / 0.03 = 800M full rahn
    expect(toFullDeposit({ deposit: 300 * M, monthlyRent: 15 * M })).toBe(800 * M);
  });

  it("converts deposit into equivalent rent", () => {
    // 300M rahn + 15M ejare → 15M + 300M * 0.03 = 24M full ejare
    expect(toFullRent({ deposit: 300 * M, monthlyRent: 15 * M })).toBe(24 * M);
  });

  it("leaves full-rahn and full-ejare listings unchanged on their own axis", () => {
    expect(toFullDeposit({ deposit: 1_000 * M, monthlyRent: 0 })).toBe(1_000 * M);
    expect(toFullRent({ deposit: 0, monthlyRent: 20 * M })).toBe(20 * M);
  });

  it("makes two differently-split prices comparable", () => {
    const a = { deposit: 200 * M, monthlyRent: 18 * M }; // = 800M
    const b = { deposit: 500 * M, monthlyRent: 9 * M }; //  = 800M
    expect(toFullDeposit(a)).toBe(toFullDeposit(b));
    expect(toFullRent(a)).toBe(toFullRent(b));
  });

  it("re-balances rent when the tenant pays a different deposit", () => {
    const p = { deposit: 300 * M, monthlyRent: 20 * M };
    expect(rentAtDeposit(p, 500 * M)).toBe(14 * M); // +200M deposit → −6M rent
    expect(rentAtDeposit(p, 100 * M)).toBe(26 * M); // −200M deposit → +6M rent
    expect(rentAtDeposit(p, 300 * M)).toBe(20 * M);
  });

  it("returns null when the requested split is impossible", () => {
    const p = { deposit: 300 * M, monthlyRent: 3 * M }; // full rahn = 400M
    expect(rentAtDeposit(p, 500 * M)).toBeNull();
    expect(depositAtRent({ deposit: 50 * M, monthlyRent: 10 * M }, 20 * M)).toBeNull();
  });

  it("round-trips deposit ↔ rent", () => {
    const p = { deposit: 450 * M, monthlyRent: 18 * M };
    const rent = rentAtDeposit(p, 600 * M)!;
    expect(depositAtRent(p, rent)).toBe(600 * M);
  });

  it("supports a custom rate", () => {
    expect(toFullDeposit({ deposit: 0, monthlyRent: 25 * M }, 0.025)).toBe(1_000 * M);
  });

  it("computes full-deposit price per m²", () => {
    expect(pricePerM2({ deposit: 300 * M, monthlyRent: 15 * M, areaM2: 100 })).toBe(8 * M);
  });
});

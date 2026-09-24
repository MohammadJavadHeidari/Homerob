import { describe, expect, it } from "vitest";

import { listings } from "@/data/listings";

import { isPlaceholderPrice, isSharedHousing } from "./quality";

const M = 1_000_000;

describe("data quality", () => {
  it("flags dummy prices", () => {
    expect(isPlaceholderPrice({ deposit: 1_000, monthlyRent: 1_000 })).toBe(true);
    expect(isPlaceholderPrice({ deposit: 1_111_111, monthlyRent: 111_111 })).toBe(true);
    expect(isPlaceholderPrice({ deposit: 999_999_999, monthlyRent: 0 })).toBe(true);
  });

  it("keeps real prices, including full rahn and small deposits", () => {
    expect(isPlaceholderPrice({ deposit: 450 * M, monthlyRent: 18 * M })).toBe(false);
    expect(isPlaceholderPrice({ deposit: 1_100 * M, monthlyRent: 0 })).toBe(false);
    expect(isPlaceholderPrice({ deposit: 50 * M, monthlyRent: 10 * M })).toBe(false);
  });

  it("flags shared rooms in any spelling", () => {
    expect(isSharedHousing({ title: "اجاره اتاق در واحد دوخوابه", description: "" })).toBe(true);
    expect(isSharedHousing({ title: "هم‌خونه آقا", description: "" })).toBe(true);
    expect(isSharedHousing({ title: "آپارتمان ۹۵ متری", description: "مناسب خانواده" })).toBe(false);
  });

  it("finds exactly the seeded data-quality cases", () => {
    expect(listings.filter(isPlaceholderPrice).map((l) => l.id).sort()).toEqual(["dv-0907", "sp-0908"]);
    expect(listings.filter(isSharedHousing).map((l) => l.id).sort()).toEqual(["dv-0909", "sp-0910"]);
  });
});

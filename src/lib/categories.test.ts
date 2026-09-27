import { describe, expect, it } from "vitest";

import { listings } from "@/data/listings";
import { comparablePrice, detectCategory } from "@/lib/categories";
import { withCategory } from "@/lib/intent/category";
import { parseIntentWithRules as parse } from "@/lib/intent/rules";
import { EMPTY_INTENT, type SearchIntent } from "@/lib/intent/schema";
import { isPlaceholderPrice } from "@/lib/quality";
import { search } from "@/lib/search";
import type { Listing } from "@/lib/types";

const M = 1_000_000;
const B = 1_000_000_000;

describe("category detection", () => {
  it.each([
    ["دوخوابه وکیل‌آباد ۵۰۰ رهن", null],
    ["خونه با انباری و پارکینگ", null],
    ["میخوام یه آپارتمان تو شیراز بخرم", "residential-sale"],
    ["آپارتمان فروشی دوخوابه", "residential-sale"],
    ["مغازه برای اجاره، رهن ۲۰۰", "commercial-rent"],
    ["اجاره اتاق اداری نزدیک میدان", "commercial-rent"],
    ["خرید دفتر کار اداری", "commercial-sale"],
    ["سوئیت مبله روزانه", "short-term"],
    ["ویلا برای آخر هفته", "short-term"],
    ["پیش‌فروش آپارتمان", "projects"],
    ["زمین برای مشارکت در ساخت", "projects"],
  ])("%s → %s", (q, expected) => {
    expect(detectCategory(q)).toBe(expected);
  });
});

describe("rule parser with categories", () => {
  it("reads a purchase budget as a total price", () => {
    const i = parse("خرید آپارتمان دوخوابه تا ۵ میلیارد");
    expect(i.category).toBe("residential-sale");
    expect(i.maxPrice).toBe(5 * B);
    expect(i.maxDeposit).toBeNull();
    expect(i.minRooms).toBe(2);
  });

  it("reads a nightly budget for a short stay", () => {
    const i = parse("سوئیت مبله روزانه، شبی ۲ تومن");
    expect(i.category).toBe("short-term");
    expect(i.maxPrice).toBe(2 * M);
    expect(i.maxRent).toBeNull();
  });

  it("keeps rahn / ejare for a shop and doesn't read «اجاره اتاق» as a shared flat", () => {
    const shop = parse("مغازه برای اجاره، رهن ۲۰۰ اجاره ۱۰");
    expect(shop.category).toBe("commercial-rent");
    expect(shop.maxDeposit).toBe(200 * M);
    expect(shop.maxRent).toBe(10 * M);
    expect(parse("اجاره اتاق اداری").sharedRoom).toBe(false);
  });
});

describe("switching category by hand", () => {
  const rent: SearchIntent = { ...EMPTY_INTENT, maxDeposit: 500 * M, minRooms: 2, neighborhoods: ["وکیل‌آباد"] };

  it("drops a rahn budget when switching to a sale, keeps the rest", () => {
    const sale = withCategory(rent, "residential-sale");
    expect(sale).toMatchObject({ category: "residential-sale", maxDeposit: null, maxPrice: null, minRooms: 2 });
    expect(sale.neighborhoods).toEqual(["وکیل‌آباد"]);
  });

  it("keeps the budget between two rentals, drops rooms for offices", () => {
    expect(withCategory(rent, "commercial-rent")).toMatchObject({ maxDeposit: 500 * M, minRooms: null });
  });
});

describe("search by category", () => {
  // Test-only fixtures (never shipped as data): the same flat priced three ways.
  const base = listings[0];
  const sale: Listing = { ...base, id: "t-sale", category: "residential-sale", deposit: 0, monthlyRent: 0, price: 4 * B };
  const night: Listing = { ...base, id: "t-night", category: "short-term", deposit: 0, monthlyRent: 0, nightlyPrice: 2 * M };
  const pool = [base, sale, night];

  it("prices each category its own way", () => {
    expect(comparablePrice(sale)).toBe(4 * B);
    expect(comparablePrice(night)).toBe(2 * M);
    expect(isPlaceholderPrice(sale)).toBe(false);
    expect(isPlaceholderPrice({ ...sale, price: 0 })).toBe(true);
  });

  it("returns only the asked category; rentals stay the default", () => {
    expect(search(EMPTY_INTENT, pool).results.map((r) => r.listing.id)).toEqual([base.id]);
    const ids = (i: Partial<SearchIntent>) => search({ ...EMPTY_INTENT, ...i }, pool).results.map((r) => r.listing.id);
    expect(ids({ category: "residential-sale" })).toEqual(["t-sale"]);
    expect(ids({ category: "short-term" })).toEqual(["t-night"]);
  });

  it("hard-filters a sale by its total price", () => {
    const run = (maxPrice: number) => search({ ...EMPTY_INTENT, category: "residential-sale", maxPrice }, pool).total;
    expect(run(5 * B)).toBe(1);
    expect(run(3 * B)).toBe(0);
  });
});

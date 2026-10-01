import { describe, expect, it } from "vitest";

import { draftToAd, EMPTY_DRAFT, toSearchable, validateDraft } from "./ads";
import { importTable, parseMoneyFa, parseTable, TEMPLATE_COLUMNS } from "./import-file";
import { normalizeMobile } from "./session";
import { adInsights, contactRate, deltaFa, overview, startOfDay } from "./stats";

const M = 1_000_000;
const owner = { role: "agency" as const, phone: "09120000000", name: "املاک نمونه" };

describe("normalizeMobile", () => {
  it("accepts Persian digits, +98 and missing leading zero", () => {
    expect(normalizeMobile("۰۹۱۲ ۳۴۵ ۶۷۸۹")).toBe("09123456789");
    expect(normalizeMobile("+98 912 345 6789")).toBe("09123456789");
    expect(normalizeMobile("9123456789")).toBe("09123456789");
  });
  it("rejects landlines and short numbers", () => {
    expect(normalizeMobile("05138000000")).toBeNull();
    expect(normalizeMobile("0912")).toBeNull();
  });
});

describe("ad drafts", () => {
  it("requires a price that matches the category", () => {
    const d = { ...EMPTY_DRAFT, title: "آپارتمان دوخوابه", neighborhood: "وکیل‌آباد", areaM2: 90 };
    expect(validateDraft(d).deposit).toBeTruthy();
    expect(validateDraft({ ...d, deposit: 500 * M })).toEqual({});
    expect(validateDraft({ ...d, category: "residential-sale" }).price).toBeTruthy();
  });

  it("canonicalizes the neighborhood and keeps rent fields only for rentals", () => {
    const ad = draftToAd(
      { ...EMPTY_DRAFT, title: "آپارتمان", neighborhood: "وکیل آباد", areaM2: 90, deposit: 500 * M, monthlyRent: 10 * M },
      owner,
      "form",
    );
    expect(ad.id).toMatch(/^hr-/);
    expect(ad.neighborhood).toBe("وکیل‌آباد");
    expect(ad.source).toBe("homerob");
    const sale = draftToAd({ ...EMPTY_DRAFT, category: "residential-sale", title: "x", areaM2: 90, deposit: 5, price: 9e9 }, owner, "form");
    expect(sale.deposit).toBe(0);
    expect(sale.price).toBe(9e9);
  });

  it("never sends photos or the poster's phone to the server", () => {
    const ad = draftToAd({ ...EMPTY_DRAFT, title: "آپارتمان", areaM2: 90, deposit: M, images: ["data:image/jpeg;base64,xx"] }, owner, "form");
    const s = toSearchable(ad) as unknown as Record<string, unknown>;
    expect(s.images).toBeUndefined();
    expect(s.ownerPhone).toBeUndefined();
    expect(s.imageUrl).toBeUndefined();
  });
});

describe("agency file import", () => {
  it("reads Persian money in all the usual forms", () => {
    expect(parseMoneyFa("۵۰۰ میلیون")).toBe(500 * M);
    expect(parseMoneyFa("1.2 میلیارد")).toBe(1.2e9);
    expect(parseMoneyFa("۱٫۵ میلیارد تومان")).toBe(1.5e9);
    expect(parseMoneyFa("500,000,000")).toBe(500 * M);
    expect(parseMoneyFa("۵۰۰")).toBe(500 * M);
    expect(parseMoneyFa("")).toBeNull();
  });

  it("parses quoted CSV cells and tab-separated cells pasted from Excel", () => {
    expect(parseTable('a,b\n"x, y","he said ""hi"""\n')).toEqual([
      ["a", "b"],
      ["x, y", 'he said "hi"'],
    ]);
    expect(parseTable("a\tb\r\n1\t2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("finds columns by name in any order and validates each row", () => {
    const csv = [
      "متراژ,محله,عنوان,رهن,اجاره,پارکینگ,ستون عجیب",
      "۹۰,وکیل آباد,آپارتمان دوخوابه نوساز,۵۰۰,۱۰,دارد,x",
      "۷۰,هاشمیه,,۳۰۰,,ندارد,y",
    ].join("\n");
    const r = importTable(csv, { city: "مشهد" });
    expect(r.unknown).toEqual(["ستون عجیب"]);
    expect(r.rows).toHaveLength(2);
    const [ok, bad] = r.rows;
    expect(ok.errors).toEqual({});
    expect(ok.draft).toMatchObject({ areaM2: 90, deposit: 500 * M, monthlyRent: 10 * M, parking: true, city: "مشهد" });
    expect(bad.line).toBe(3);
    expect(bad.errors.title).toBeTruthy();
  });

  it("the template header round-trips", () => {
    const r = importTable(TEMPLATE_COLUMNS.join(","), { city: "مشهد" });
    expect(r.found).toHaveLength(TEMPLATE_COLUMNS.length);
    expect(r.rows).toEqual([]);
  });
});

describe("agency stats", () => {
  const now = new Date(2026, 9, 1, 15).getTime();
  const day = 864e5;
  const ev = (id: string, type: "impression" | "view" | "contact" | "save", daysAgo: number) => ({ id, type, at: now - daysAgo * day });

  it("counts only the agency's ads, per day and per week", () => {
    const o = overview(
      [ev("a", "view", 0), ev("a", "view", 0), ev("a", "contact", 1), ev("b", "view", 9), ev("other", "view", 0)],
      ["a", "b"],
      now,
    );
    expect(o.totals.view).toBe(3);
    expect(o.last7.view).toBe(2);
    expect(o.prev7.view).toBe(1);
    expect(o.dailyViews.at(-1)).toBe(2);
    expect(o.days.at(-1)).toBe(startOfDay(now));
    expect(o.byAd.a.contact).toBe(1);
    expect(o.byAd.b.daily[o.days.length - 10]).toBe(1);
  });

  it("rates and deltas", () => {
    expect(contactRate({ view: 0, contact: 0 })).toBeNull();
    expect(contactRate({ view: 4, contact: 1 })).toBe(0.25);
    expect(deltaFa(12, 8)).toEqual({ text: "+۵۰٪", up: true });
    expect(deltaFa(3, 0)).toBeNull();
  });

  it("price insight needs enough real ads to compare with", () => {
    const ad = { category: "residential-rent" as const, deposit: 1000 * M, monthlyRent: 0, areaM2: 100, images: ["x"] };
    const counts = { impression: 0, view: 0, contact: 0, save: 0 };
    expect(adInsights(ad, counts, { medianPpm: 5 * M, sample: 3 })).toEqual([]);
    const [i] = adInsights(ad, counts, { medianPpm: 5 * M, sample: 12 });
    expect(i.tone).toBe("warn");
    expect(i.text).toContain("۱۰۰٪ گرون‌تر");
  });
});

describe("device-posted ads in search requests", async () => {
  const { ExtraListings } = await import("./listing-schema");
  it("drops invalid entries instead of failing the request", () => {
    const ok = toSearchable(draftToAd({ ...EMPTY_DRAFT, title: "آپارتمان", neighborhood: "وکیل‌آباد", areaM2: 90, deposit: M }, owner, "form"));
    const parsed = ExtraListings.parse([ok, { id: "hr-bad!", source: "homerob" }]);
    expect(parsed).toHaveLength(1);
    expect(parsed![0].id).toBe(ok.id);
  });
});

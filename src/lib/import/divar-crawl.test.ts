import { describe, expect, it } from "vitest";

import { crawledToListing, type CrawledAd } from "./divar-crawl";

// Hand-written crawler records in the shape scripts/divar_crawler.py writes (test input only, never served).
const base: CrawledAd = {
  schema: "homerob-divar-crawl/1",
  token: "TestTok1",
  crawled_at: "2026-10-01T12:00:00+00:00",
  city_id: "3",
  category: "residential-rent",
  title: "آپارتمان ۸۵ متری دوخوابه",
  subtitle: "۲ ساعت پیش در مشهد، وکیل‌آباد، خ مدرس",
  city: "مشهد",
  district: "وکیل‌آباد",
  description: "طبقه دوم، بالکن دارد",
  fields: { متراژ: "۸۵", ساخت: "۱۳۹۵", اتاق: "دو", ودیعه: "۱۰۰٬۰۰۰٬۰۰۰ تومان", "اجارهٔ ماهانه": "۱۰٬۰۰۰٬۰۰۰ تومان", طبقه: "۲ از ۴" },
  features: [{ title: "آسانسور", available: true }, { title: "پارکینگ ندارد", available: false }, { title: "انباری", available: false }],
  convertible: true,
  lat: 36.35,
  lng: 59.48,
  images: [],
  card: { image: "https://s100.divarcdn.com/static/photo/a.webp" },
};

const listing = (ad: CrawledAd) => {
  const r = crawledToListing(ad);
  if (!("listing" in r)) throw new Error(`skipped: ${r.skip}`);
  return r.listing;
};

describe("crawledToListing", () => {
  it("reads the structured fields of an ad page", () => {
    const l = listing(base);
    expect(l).toMatchObject({
      id: "dv-TestTok1",
      url: "https://divar.ir/v/TestTok1",
      city: "مشهد",
      neighborhood: "وکیل‌آباد",
      street: "خ مدرس",
      deposit: 100e6,
      monthlyRent: 10e6,
      areaM2: 85,
      rooms: 2,
      floor: 2,
      totalFloors: 4,
      buildingAge: 10,
      elevator: true,
      parking: false,
      storage: false,
      convertible: true,
      lat: 36.35,
      imageUrl: "https://s100.divarcdn.com/static/photo/a.webp",
    });
    expect(l.tags).toContain("بالکن");
    expect(l.postedAt).toBe("2026-10-01T10:00:00.000Z");
  });

  it("treats a symbolic rent next to a real deposit as full rahn", () => {
    expect(listing({ ...base, fields: { ...base.fields, "اجارهٔ ماهانه": "۱۰۰٬۰۰۰ تومان", ودیعه: "۱ میلیارد" } }).monthlyRent).toBe(0);
  });

  it("leaves unstated values unset", () => {
    const l = listing({ ...base, title: "آپارتمان", description: "", fields: { متراژ: "۷۰", ودیعه: "۲۰۰ میلیون" }, features: [] });
    expect(l.rooms).toBeUndefined();
    expect(l.floor).toBeUndefined();
    expect(l.buildingAge).toBeUndefined();
    expect(l.parking).toBeUndefined();
  });

  it("skips what Homerob doesn't serve yet, with a reason", () => {
    const skip = (ad: CrawledAd) => {
      const r = crawledToListing(ad);
      return "skip" in r ? r.skip : "";
    };
    expect(skip({ ...base, category: "residential-sell" })).toMatch(/category/);
    expect(skip({ ...base, fields: { متراژ: "۸۵" }, card: {} })).toMatch(/no deposit/);
    expect(skip({ ...base, meta: { category: "office-rent" } })).toBe("commercial");
    expect(skip({ ...base, district: "جای ناشناخته", subtitle: "", title: "آپارتمان", description: "" })).toMatch(/not registered/);
    expect(skip({ ...base, fields: { ...base.fields, متراژ: "۸" }, title: "اتاق", description: "" })).toMatch(/area/);
  });
});

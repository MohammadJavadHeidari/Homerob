import { describe, expect, it } from "vitest";

import { listings } from "@/data/listings";

import { areaAround, canonicalNeighborhood, catalogFromListings, findNeighborhoods, nearestHood, withPositions } from "./catalog";
import { EMPTY_INTENT } from "./intent/schema";
import { makeContext, search } from "./search";

const catalog = catalogFromListings(listings);
const hoods = catalog.hoods;

describe("neighborhood names", () => {
  it("matches the short forms people type", () => {
    expect(findNeighborhoods("دوخوابه وکیل آباد", hoods)).toEqual(["وکیل‌آباد"]);
    expect(findNeighborhoods("یه آپارتمان تو قاسم آباد", hoods)).toEqual(["قاسم‌آباد (شهرک غرب)"]);
    expect(findNeighborhoods("سجاد، رهن ۵۰۰", hoods)).toEqual(["بلوار سجاد"]);
    expect(findNeighborhoods("کوثر یا هاشمیه", hoods)).toEqual(["محله کوثر", "هاشمیه"]);
  });

  it("matches whole words only", () => {
    expect(findNeighborhoods("دانشجوام، سجادیه", hoods)).toEqual([]);
  });

  it("canonicalizes LLM output", () => {
    expect(canonicalNeighborhood("وکیلاباد", hoods)).toBe("وکیل‌آباد");
    expect(canonicalNeighborhood("طبرسی شمالی", hoods)).toBe("طبرسی شمالی");
    expect(canonicalNeighborhood("پاریس", hoods)).toBeNull();
  });
});

describe("catalog", () => {
  it("has a center and neighbors for the big neighborhoods", () => {
    const vakil = hoods.find((h) => h.name === "وکیل‌آباد")!;
    expect(vakil.center).not.toBeNull();
    expect(vakil.medianPpm2).toBeGreaterThan(1e6);
    expect(catalog.adjacent["وکیل‌آباد"].length).toBeGreaterThan(0);
  });

  it("finds the nearest neighborhood to a point", () => {
    const vakil = hoods.find((h) => h.name === "وکیل‌آباد")!.center!;
    expect(nearestHood(catalog, vakil)).toBe("وکیل‌آباد");
    expect(nearestHood(catalog, { lat: 35.7, lng: 51.4 })).toBeNull();
  });
});

describe("near-me search", () => {
  const ctx = makeContext(withPositions(listings, catalog), catalog);

  it("limits results to the user's area, own neighborhood first", () => {
    const { results } = search({ ...EMPTY_INTENT, nearMe: "الهیه" }, ctx);
    const area = areaAround(catalog, "الهیه");
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) expect(area).toContain(r.listing.neighborhood);
    expect(results[0].listing.neighborhood).toBe("الهیه");
  });

  it("ignores near-me when the query names a neighborhood", () => {
    const named = { ...EMPTY_INTENT, neighborhoods: ["وکیل‌آباد"] };
    expect(search({ ...named, nearMe: "الهیه" }, ctx).total).toBe(search(named, ctx).total);
  });
});

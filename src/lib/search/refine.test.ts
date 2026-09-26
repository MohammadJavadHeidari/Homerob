import { describe, expect, it } from "vitest";

import { EMPTY_INTENT } from "@/lib/intent/schema";

import { syntheticContext } from "@/data/fixtures";

import { search } from "./index";
import { activeCount, applyRefine, bounds, clampRanges, EMPTY_REFINE, facets, histogram, ppmOf, priceOf } from "./refine";

const { results } = search(EMPTY_INTENT, syntheticContext(), Infinity);

describe("refine", () => {
  it("is a no-op with no filters and keeps the AI ranking", () => {
    expect(applyRefine(results, EMPTY_REFINE)).toEqual(results);
  });

  it("combines filters with AND", () => {
    const out = applyRefine(results, { ...EMPTY_REFINE, rooms: [2], neighborhoods: ["سجاد"], amenities: ["parking"] });
    expect(out.length).toBeGreaterThan(0);
    for (const r of out) {
      expect(r.listing.rooms).toBe(2);
      expect(r.listing.neighborhood).toBe("سجاد");
      expect(r.listing.parking).toBe(true);
    }
  });

  it("treats rooms bucket 4 as 4+ and filters ranges inclusively", () => {
    const four = applyRefine(results, { ...EMPTY_REFINE, rooms: [4] });
    expect(four.every((r) => r.listing.rooms >= 4)).toBe(true);
    const cheap = applyRefine(results, { ...EMPTY_REFINE, price: [0, 800e6] });
    expect(cheap.every((r) => priceOf(r) <= 800e6)).toBe(true);
  });

  it("sorts by price per m² ascending", () => {
    const out = applyRefine(results, { ...EMPTY_REFINE, sort: "ppm" });
    for (let i = 1; i < out.length; i++) expect(ppmOf(out[i])).toBeGreaterThanOrEqual(ppmOf(out[i - 1]));
  });

  it("counts facets against the other filters only", () => {
    const f = { ...EMPTY_REFINE, rooms: [2] };
    const fc = facets(results, f);
    // selecting rooms must not zero out the other room options
    expect(fc.rooms[3]).toBeGreaterThan(0);
    // neighborhood counts respect the rooms filter
    const hoodTotal = Object.values(fc.neighborhoods).reduce((a, b) => a + b, 0);
    expect(hoodTotal).toBe(applyRefine(results, f).length);
  });

  it("builds bounds, histograms and clamps stale ranges", () => {
    expect(bounds([120, 380], 50)).toEqual([100, 400]);
    expect(histogram([0, 5, 10], [0, 10], 2)).toEqual([1, 2]);
    const f = clampRanges({ ...EMPTY_REFINE, area: [50, 500] }, { price: [0, 1], area: [60, 200], ppm: [0, 1] });
    expect(f.area).toBeNull();
    expect(activeCount({ ...EMPTY_REFINE, rooms: [1, 2], maxAge: 5 })).toBe(3);
  });
});

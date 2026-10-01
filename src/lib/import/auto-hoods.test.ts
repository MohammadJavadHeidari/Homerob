import { describe, expect, it } from "vitest";

import { HOODS } from "../places";
import { isStrictName, proposeHoods } from "./auto-hoods";

describe("proposeHoods", () => {
  it("registers an unknown district at the median of its exact ad points, next to its neighbors", () => {
    const [h, ...rest] = proposeHoods(
      [
        { city: "مشهد", district: "ابن سینا (تست)", lat: 36.3, lng: 59.55, exact: true },
        { city: "مشهد", district: "ابن سینا (تست)", lat: 36.31, lng: 59.56, exact: true },
        { city: "مشهد", district: "ابن سینا (تست)", lat: 36.9, lng: 59.9, exact: false }, // fuzzy: ignored
        { city: "مشهد", district: "بی‌نقطه", lat: null, lng: null }, // no point: not registered
        { city: "مشهد", district: "الهیه", lat: 36.37, lng: 59.48, exact: true }, // known
      ],
      HOODS,
    );
    expect(rest).toEqual([]);
    expect(h).toMatchObject({ name: "ابن سینا", city: "مشهد", center: { lat: 36.305, lng: 59.555 }, aliases: ["ابن سینا (تست)"] });
    expect(h.strict).toBeUndefined(); // two words: a place name
    expect(h.adjacent.length).toBeGreaterThan(0);
    expect(h.adjacent.length).toBeLessThanOrEqual(5);
  });

  it("marks one-word names that may be everyday words or cities as strict", () => {
    expect(isStrictName("گلستان")).toBe(true);
    expect(isStrictName("خرمشهر")).toBe(true); // also a city
    expect(isStrictName("قاسم‌آباد")).toBe(false);
    expect(isStrictName("شهرک غرب")).toBe(false);
  });
});

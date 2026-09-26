import { describe, expect, it } from "vitest";

import { CITIES, hoodInfo, hoodsIn } from "@/lib/places";

import { listings } from "./listings";

describe("listings", () => {
  it("has unique ids", () => {
    expect(listings.length).toBeGreaterThan(0);
    expect(new Set(listings.map((l) => l.id)).size).toBe(listings.length);
  });

  it("uses only registered cities and neighborhoods", () => {
    for (const l of listings) {
      expect(CITIES.map((c) => c.fa)).toContain(l.city);
      expect(hoodInfo(l.neighborhood, l.city)).toBeDefined();
    }
  });

  it("has listings in every registered neighborhood", () => {
    for (const city of new Set(listings.map((l) => l.city))) {
      for (const h of hoodsIn(city)) {
        expect(listings.filter((l) => l.city === city && l.neighborhood === h.name).length).toBeGreaterThan(0);
      }
    }
  });

  it("has sane values", () => {
    for (const l of listings) {
      expect(["divar", "sheypoor"]).toContain(l.source);
      expect(l.deposit).toBeGreaterThanOrEqual(0);
      expect(l.monthlyRent).toBeGreaterThanOrEqual(0);
      expect(l.deposit + l.monthlyRent).toBeGreaterThan(0);
      expect(l.areaM2).toBeGreaterThan(10);
      expect(l.floor).toBeLessThanOrEqual(l.totalFloors);
      expect(Number.isNaN(Date.parse(l.postedAt))).toBe(false);
      expect(l.title.length).toBeGreaterThan(5);
    }
  });
});

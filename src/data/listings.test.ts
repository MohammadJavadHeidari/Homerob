import { describe, expect, it } from "vitest";

import { CITIES, HOODS, hoodInfo } from "@/lib/places";

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

  // Neighborhoods may be registered before their ads arrive (a query naming them gets an honest empty
  // state), but every covered city must have ads.
  it("has listings in every covered city", () => {
    for (const city of new Set(HOODS.map((h) => h.city))) {
      expect(listings.some((l) => l.city === city)).toBe(true);
    }
  });

  it("has sane values", () => {
    for (const l of listings) {
      expect(["divar", "sheypoor"]).toContain(l.source);
      expect(l.deposit).toBeGreaterThanOrEqual(0);
      expect(l.monthlyRent).toBeGreaterThanOrEqual(0);
      expect(l.deposit + l.monthlyRent).toBeGreaterThan(0);
      expect(l.areaM2).toBeGreaterThan(10);
      if (l.floor !== undefined && l.totalFloors !== undefined) expect(l.floor).toBeLessThanOrEqual(l.totalFloors);
      expect(Number.isNaN(Date.parse(l.postedAt))).toBe(false);
      expect(l.title.length).toBeGreaterThan(2); // real titles can be as short as «60متر»
    }
  });

  it("real ads link to the original, carry no phone numbers and are rentals", () => {
    for (const l of listings) {
      expect(l.url).toMatch(/^https:\/\/divar\.ir\/v\/[\w-]+$/);
      expect(l.id).toBe(`dv-${l.url!.split("/").pop()}`);
      expect(`${l.title} ${l.description}`).not.toMatch(/(?:09|۰۹)[\d۰-۹]{9}/);
      expect(l.deposit + l.monthlyRent).toBeGreaterThan(0);
    }
  });
});

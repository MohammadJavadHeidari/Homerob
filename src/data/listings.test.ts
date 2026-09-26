import { describe, expect, it } from "vitest";

import { NEIGHBORHOODS } from "@/lib/types";

import { listings as all, scrapedListings, seedListings as listings } from "./listings";

describe("seed listings", () => {
  it("has ~80–100 listings with unique ids", () => {
    expect(listings.length).toBeGreaterThanOrEqual(80);
    expect(listings.length).toBeLessThanOrEqual(100);
    expect(new Set(listings.map((l) => l.id)).size).toBe(listings.length);
  });

  it("covers every neighborhood", () => {
    for (const n of NEIGHBORHOODS) {
      expect(listings.filter((l) => l.neighborhood === n).length).toBeGreaterThanOrEqual(10);
    }
  });

  it("has sane values", () => {
    for (const l of listings) {
      expect(NEIGHBORHOODS).toContain(l.neighborhood);
      expect(["divar", "sheypoor"]).toContain(l.source);
      expect(l.deposit).toBeGreaterThanOrEqual(0);
      expect(l.monthlyRent).toBeGreaterThanOrEqual(0);
      expect(l.deposit + l.monthlyRent).toBeGreaterThan(0);
      expect(l.areaM2).toBeGreaterThan(20);
      expect(l.floor).toBeLessThanOrEqual(l.totalFloors);
      expect(Number.isNaN(Date.parse(l.postedAt))).toBe(false);
      expect(l.title.length).toBeGreaterThan(5);
    }
  });
});

describe("all listings (seed + scraped)", () => {
  it("has unique ids and valid scraped rows", () => {
    expect(new Set(all.map((l) => l.id)).size).toBe(all.length);
    for (const l of scrapedListings) {
      expect(NEIGHBORHOODS).toContain(l.neighborhood);
      expect(l.deposit + l.monthlyRent).toBeGreaterThan(0);
      expect(l.floor).toBeLessThanOrEqual(l.totalFloors);
    }
  });
});

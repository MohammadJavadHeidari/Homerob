import { describe, expect, it } from "vitest";

import { NEIGHBORHOODS, type Listing } from "@/lib/types";

import scraped from "./scraped.json";

const listings = scraped as Listing[];

describe("scraped listings", () => {
  it("have unique ids and sane values", () => {
    expect(new Set(listings.map((l) => l.id)).size).toBe(listings.length);
    for (const l of listings) {
      expect(NEIGHBORHOODS).toContain(l.neighborhood);
      expect(["divar", "sheypoor"]).toContain(l.source);
      expect(l.deposit + l.monthlyRent).toBeGreaterThan(0);
      expect(l.floor).toBeLessThanOrEqual(l.totalFloors);
      expect(Number.isNaN(Date.parse(l.postedAt))).toBe(false);
    }
  });
});

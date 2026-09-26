import { describe, expect, it } from "vitest";

import { isComparable } from "@/lib/quality";

import { listings } from "./listings";

describe("bundled real listings (Mashhad sample)", () => {
  it("has 1,000 unique Divar ads in 25 neighborhoods", () => {
    expect(listings.length).toBe(1000);
    expect(new Set(listings.map((l) => l.id)).size).toBe(listings.length);
    expect(new Set(listings.map((l) => l.neighborhood)).size).toBe(25);
    expect(listings.every((l) => l.source === "divar" && l.city === "mashhad")).toBe(true);
  });

  it("has sane prices, areas and positions", () => {
    for (const l of listings) {
      expect(l.deposit + l.monthlyRent).toBeGreaterThan(0);
      expect(l.areaM2).toBeGreaterThanOrEqual(20);
      expect(l.rooms).toBeGreaterThanOrEqual(0);
      expect(Number.isNaN(Date.parse(l.postedAt))).toBe(false);
      if (l.lat != null) expect(l.lat).toBeGreaterThan(36.1);
    }
    expect(listings.filter(isComparable).length).toBe(listings.length);
  });

  it("carries no phone numbers", () => {
    const phone = /(?:\+98|0|۰)[9۹](?:[\s-]?[0-9۰-۹]){9}/;
    expect(listings.filter((l) => phone.test(l.title + " " + l.description))).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";

import pois from "@/data/pois.json";
import { listings } from "@/data/listings";
import { listingLatLng } from "@/lib/geo";
import { itemText, MAX_ITEMS, nearbyItems, ruleTitle, type Poi } from "@/lib/nearby/facts";

const home = { lat: 36.3345, lng: 59.4875 };
const at = (dLatMeters: number): { lat: number; lng: number } => ({ lat: home.lat + dLatMeters / 111_320, lng: home.lng });

describe("nearbyItems", () => {
  it("keeps only places within walking range and reports walking minutes", () => {
    const items = nearbyItems(home, [
      { c: "supermarket", ...at(150), n: "سوپر نمونه" },
      { c: "supermarket", ...at(5000) },
      { c: "gym", ...at(3000) },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ key: "supermarket", name: "سوپر نمونه", minutes: 2, h24: false });
  });

  it("prefers a 24/7 place over a slightly closer one", () => {
    const [p] = nearbyItems(home, [
      { c: "pharmacy", ...at(100), n: "داروخانه الف" },
      { c: "pharmacy", ...at(300), n: "داروخانه شبانه روزی ب", h24: 1 },
    ]);
    expect(p).toMatchObject({ name: "داروخانه شبانه روزی ب", h24: true, label: "داروخانه شبانه‌روزی" });
  });

  it("counts bus stops instead of naming one", () => {
    const items = nearbyItems(home, [
      { c: "bus", ...at(100) },
      { c: "bus", ...at(200) },
      { c: "bus", ...at(250) },
    ]);
    expect(items[0].count).toBe(3);
    expect(itemText(items[0])).toContain("۳ ایستگاه اتوبوس");
  });

  it("finds real advantages for every seeded Mashhad listing", () => {
    const all = (pois as { cities: Record<string, Poi[]> }).cities["مشهد"];
    for (const l of listings) {
      const items = nearbyItems(listingLatLng(l), all);
      expect(items.length, l.id).toBeGreaterThan(0);
      expect(items.length).toBeLessThanOrEqual(MAX_ITEMS);
      expect(ruleTitle(items).length).toBeGreaterThan(5);
    }
  });
});

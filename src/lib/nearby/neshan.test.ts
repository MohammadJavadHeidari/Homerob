import { describe, expect, it } from "vitest";

import { nearbyItems } from "@/lib/nearby/facts";
import { fromNearby, fromSearch } from "@/lib/nearby/neshan";

// shapes from docs/research/neshan-api.md

const nearbyAnswer = (names: string[]) => ({
  layerPoints: {
    layer: { farsiTitle: "مسجد", icon: "https://static.neshanmap.ir/poi/64/mosque.png", slug: "mosque" },
    nearestPoints: names.map((name, i) => ({
      distance: 400 + i * 100,
      duration: 70,
      location: { latitude: 36.3345 + i * 0.001, longitude: 59.4875 },
      name,
      poiHash: "x",
    })),
  },
});

const searchAnswer = (items: { title: string; type?: string; category?: string }[]) => ({
  count: items.length,
  items: items.map((it, i) => ({
    address: "مشهد، وکیل‌آباد",
    region: "مشهد، استان خراسان رضوی",
    neighbourhood: "",
    category: "place",
    location: { x: 59.4875 + i * 0.001, y: 36.3345 },
    poiHash: "x",
    ...it,
  })),
});

describe("fromNearby (/v1/nearby)", () => {
  it("reads name + location and skips streets named after the place", () => {
    const pois = fromNearby("mosque", nearbyAnswer(["مسجد امام رضا", "خیابان مسجد"]));
    expect(pois).toEqual([{ c: "mosque", lat: 36.3345, lng: 59.4875, n: "مسجد امام رضا", s: "neshan" }]);
  });

  it("keeps unnamed layer hits without a name", () => {
    expect(fromNearby("bus", nearbyAnswer([""]))[0]).toEqual({ c: "bus", lat: 36.3345, lng: 59.4875, s: "neshan" });
  });

  it("survives junk and error bodies", () => {
    expect(fromNearby("park", null)).toEqual([]);
    expect(fromNearby("park", { status: "ERROR", code: 485, message: "Api Key services not match." })).toEqual([]);
  });
});

describe("fromSearch (/v3/search)", () => {
  it("keeps places by Neshan type or by name, drops streets and regions", () => {
    const pois = fromSearch(
      "pharmacy",
      searchAnswer([
        { title: "داروخانه دکتر احمدی", type: "pharmacy" },
        { title: "دکتر نبوی", type: "pharmacy" },
        { title: "خیابان داروخانه", type: "street", category: "municipal" },
        { title: "داروخانه شبانه روزی سینا" },
      ]),
    );
    expect(pois.map((p) => p.n)).toEqual(["داروخانه دکتر احمدی", "دکتر نبوی", "داروخانه شبانه روزی سینا"]);
    expect(pois[2].h24).toBe(1);
  });

  it("feeds nearbyItems with the source marked", () => {
    const [item] = nearbyItems({ lat: 36.3345, lng: 59.4875 }, fromSearch("supermarket", searchAnswer([{ title: "هایپرمارکت جهانی" }])));
    expect(item).toMatchObject({ key: "supermarket", name: "هایپرمارکت جهانی", source: "neshan", minutes: 1 });
  });
});

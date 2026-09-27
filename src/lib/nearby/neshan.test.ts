import { describe, expect, it } from "vitest";

import { nearbyItems } from "@/lib/nearby/facts";
import { toPois } from "@/lib/nearby/neshan";

// shape of GET https://api.neshan.org/v1/search (location.x = lng, location.y = lat)
const answer = (titles: string[]) => ({
  count: titles.length,
  items: titles.map((title, i) => ({
    title,
    address: "مشهد، وکیل‌آباد",
    type: "place",
    category: "place",
    location: { x: 59.4875 + i * 0.001, y: 36.3345, z: "NaN" },
  })),
});

describe("toPois (Neshan search → places)", () => {
  it("keeps real places of the category and drops streets with the same word", () => {
    const pois = toPois("mosque", answer(["مسجد امام رضا", "خیابان مسجد", "بلوار مسجد جامع"]));
    expect(pois.map((p) => p.n)).toEqual(["مسجد امام رضا"]);
    expect(pois[0]).toMatchObject({ c: "mosque", lat: 36.3345, lng: 59.4875, s: "neshan" });
  });

  it("separates metro from bus stops and flags 24h places", () => {
    expect(toPois("rail", answer(["ایستگاه مترو صدف", "ایستگاه اتوبوس صدف"])).map((p) => p.n)).toEqual(["ایستگاه مترو صدف"]);
    expect(toPois("pharmacy", answer(["داروخانه شبانه روزی دکتر نبوی"]))[0].h24).toBe(1);
  });

  it("survives junk answers", () => {
    expect(toPois("park", null)).toEqual([]);
    expect(toPois("park", { items: [{ title: "پارک ملت" }] })).toEqual([]);
  });

  it("marks advantages found through Neshan", () => {
    const [item] = nearbyItems({ lat: 36.3345, lng: 59.4875 }, toPois("pharmacy", answer(["داروخانه دکتر احمدی"])));
    expect(item).toMatchObject({ key: "pharmacy", name: "داروخانه دکتر احمدی", source: "neshan" });
  });
});

import { describe, expect, it } from "vitest";

import { listings } from "@/data/listings";
import { EMPTY_INTENT } from "@/lib/intent/schema";
import { isPlaceholderPrice } from "@/lib/quality";

import { belowHood, buildFeed, tasteOf } from "./feed";

const byId = (id: string) => listings.find((l) => l.id === id)!;
const keys = (f: ReturnType<typeof buildFeed>) => f.rails.map((r) => r.key);
const empty = { city: null, saved: [], viewed: [], last: null };

describe("buildFeed", () => {
  it("first visit: only the generic rails, in the city with the most listings", () => {
    const f = buildFeed(empty);
    expect(f.city).toBe("مشهد");
    expect(keys(f)).toEqual(["deals", "newest"]);
    expect(f.saved).toEqual([]);
  });

  it("deals are really under their neighborhood median, best first, no placeholder prices", () => {
    const deals = buildFeed(empty).rails.find((r) => r.key === "deals")!.items;
    expect(deals.length).toBeGreaterThan(0);
    const offs = deals.map((r) => belowHood(r.listing)!);
    for (const off of offs) expect(off).toBeGreaterThanOrEqual(0.1);
    expect([...offs].sort((a, b) => b - a)).toEqual(offs);
    for (const r of deals) expect(isPlaceholderPrice(r.listing)).toBe(false);
  });

  it("newest is sorted by date", () => {
    const items = buildFeed(empty).rails.find((r) => r.key === "newest")!.items;
    const dates = items.map((r) => r.listing.postedAt);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it("one save → «picks» on top, explained by that save, without the saved listing", () => {
    const f = buildFeed({ ...empty, saved: ["dv-0901"] });
    expect(keys(f)[0]).toBe("picks");
    const picks = f.rails[0];
    expect(picks.subtitle).toBe("چون یه دوخوابه تو وکیل‌آباد ذخیره کردی");
    expect(picks.items.map((r) => r.listing.id)).not.toContain("dv-0901");
    expect(picks.items.every((r) => r.signal?.text)).toBe(true);
    // the first cards are in (or next to) the saved neighborhood
    expect(picks.items[0].signal!.text).toMatch(/همون محله|کنار/);
    expect(f.saved.map((r) => r.listing.id)).toEqual(["dv-0901"]);
  });

  it("picks vary neighborhoods: at most 2 of one neighborhood in the first 5 unless nothing else fits", () => {
    const picks = buildFeed({ ...empty, saved: ["dv-0901", "dv-0904"] }).rails[0].items.slice(0, 5);
    const count = new Map<string, number>();
    for (const r of picks) count.set(r.listing.neighborhood, (count.get(r.listing.neighborhood) ?? 0) + 1);
    expect(Math.max(...count.values())).toBeLessThanOrEqual(2);
  });

  it("one opened listing isn't enough for picks, two are", () => {
    expect(keys(buildFeed({ ...empty, viewed: ["dv-0901"] }))).not.toContain("picks");
    const f = buildFeed({ ...empty, viewed: ["dv-0901", "dv-0904"] });
    expect(keys(f)[0]).toBe("picks");
    expect(f.rails[0].subtitle).toMatch(/دیدی$/);
    expect(keys(f)).toContain("recent");
  });

  it("continue-search rail replays the last intent and counts listings newer than it", () => {
    const intent = { ...EMPTY_INTENT, city: "مشهد", neighborhoods: ["وکیل‌آباد"], minRooms: 2, maxRooms: 2 };
    const at = Date.parse("2026-09-23T00:00:00Z");
    const f = buildFeed({ ...empty, last: { query: "دوخوابه وکیل‌آباد", intent, at } });
    const rail = f.rails.find((r) => r.key === "continue")!;
    expect(rail.subtitle).toBe("دوخوابه وکیل‌آباد");
    expect(rail.seeAll?.intent).toEqual(intent);
    const fresh = rail.items.filter((r) => r.signal?.text === "جدید");
    expect(fresh.length).toBeGreaterThan(0);
    for (const r of fresh) expect(Date.parse(r.listing.postedAt)).toBeGreaterThan(at);
    expect(rail.items.slice(0, fresh.length)).toEqual(fresh);
  });

  it("an uncovered city falls back to one with listings", () => {
    expect(buildFeed({ ...empty, city: "کیش" }).city).toBe("مشهد");
  });

  it("unknown ids are ignored", () => {
    expect(keys(buildFeed({ ...empty, saved: ["nope"] }))).toEqual(["deals", "newest"]);
  });
});

describe("tasteOf", () => {
  it("reads neighborhood, rooms and price from the saves", () => {
    const t = tasteOf([byId("dv-0901")], [])!;
    expect(t.intent.neighborhoods[0]).toBe("وکیل‌آباد");
    expect(t.intent.minRooms).toBe(2);
    expect(t.intent.city).toBe("مشهد");
    expect(t.price).toBeGreaterThan(0);
  });
});

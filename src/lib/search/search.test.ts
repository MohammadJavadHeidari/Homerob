import { describe, expect, it } from "vitest";

import { EMPTY_INTENT, type SearchIntent } from "@/lib/intent/schema";

import { search } from "./index";

const M = 1_000_000;
const intent = (p: Partial<SearchIntent>): SearchIntent => ({ ...EMPTY_INTENT, ...p });

describe("search ranking", () => {
  const flagship = intent({ maxDeposit: 500 * M, neighborhoods: ["وکیل‌آباد"], minRooms: 2 });

  it("ranks in-neighborhood 2-bedrooms first for the flagship query", () => {
    const { results } = search(flagship);
    for (const r of results.slice(0, 5)) {
      expect(r.listing.neighborhood).toBe("وکیل‌آباد");
      expect(r.listing.rooms).toBeGreaterThanOrEqual(2);
    }
    expect(results[0].score).toBeGreaterThan(results[results.length - 1].score);
  });

  it("merges the cross-source duplicate into one result", () => {
    const { results } = search(flagship);
    const ids = results.map((r) => r.listing.id);
    expect(ids).toContain("dv-0901");
    expect(ids).not.toContain("sp-0905");
    expect(results.find((r) => r.listing.id === "dv-0901")!.alsoOn).toEqual(["sheypoor"]);
  });

  it("explains the trade-off in the anchor listing", () => {
    const r = search(flagship).results.find((x) => x.listing.id === "dv-0901")!;
    expect(r.explanation).toContain("۵۰ میلیون زیر بودجه");
    expect(r.explanation).toContain("پارکینگ ندارد");
  });

  it("puts listings missing a must-have below those that have it", () => {
    const { results } = search(intent({ neighborhoods: ["احمدآباد"], mustHave: ["parking"], minRooms: 2 }));
    const firstWithout = results.findIndex((r) => !r.listing.parking);
    const lastWith = results.map((r) => r.listing.parking).lastIndexOf(true);
    if (firstWithout !== -1) expect(firstWithout).toBeGreaterThan(Math.min(lastWith, 3));
    expect(results[0].listing.parking).toBe(true);
  });

  it("keeps placeholder prices and shared rooms out, and counts them", () => {
    const vakil = search(intent({ neighborhoods: ["وکیل‌آباد"] }));
    expect(vakil.results.map((r) => r.listing.id)).not.toContain("dv-0907");
    expect(vakil.excluded.placeholderPrice).toBe(1);

    const cheap = search(intent({ maxRent: 5 * M }));
    expect(cheap.results.map((r) => r.listing.id)).not.toContain("sp-0910");
    expect(cheap.excluded.sharedRoom).toBe(2);

    const shared = search(intent({ maxRent: 5 * M, sharedRoom: true }));
    expect(shared.results.map((r) => r.listing.id).sort()).toEqual(["dv-0909", "sp-0910"]);
  });

  it("states the sample size of the neighborhood median", () => {
    const r = search(intent({ maxDeposit: 500 * M, neighborhoods: ["وکیل‌آباد"], minRooms: 2 })).results.find(
      (x) => x.listing.id === "dv-0901",
    )!;
    expect(r.highlights.map((h) => h.text).join(" ")).toMatch(/میانهٔ [۰-۹]+ آگهی وکیل‌آباد/);
  });

  it("scores stay within 0–100", () => {
    for (const r of search(intent({})).results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });
});

describe("suggest", async () => {
  const { suggest } = await import("./suggest");

  it("relaxes a too-low rent budget", () => {
    const s = suggest({ ...EMPTY_INTENT, maxRent: 5 * M, minRooms: 0, maxRooms: 0 });
    expect(s).not.toBeNull();
    expect(s!.count).toBeGreaterThan(0);
    expect(s!.intent.maxRent).toBeGreaterThan(5 * M);
    expect(s!.text).toContain("آگهی پیدا می‌شه");
  });
});

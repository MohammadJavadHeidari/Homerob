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

  it("scores stay within 0–100", () => {
    for (const r of search(intent({})).results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });
});

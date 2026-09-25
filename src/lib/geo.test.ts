import { describe, expect, it } from "vitest";

import { areaAround, distanceKm, HOOD_CENTERS, listingLatLng, locate } from "./geo";
import { EMPTY_INTENT } from "./intent/schema";
import { search } from "./search";

describe("locate", () => {
  it("finds Mashhad and the nearest neighborhood", () => {
    expect(locate({ lat: 36.335, lng: 59.49 })).toEqual({ city: "مشهد", supported: true, neighborhood: "وکیل‌آباد" });
    expect(locate({ lat: 36.3, lng: 59.59 }).neighborhood).toBe("احمدآباد");
  });

  it("names other cities but marks them unsupported", () => {
    expect(locate({ lat: 35.7, lng: 51.4 })).toEqual({ city: "تهران", supported: false, neighborhood: null });
  });

  it("returns no city far from any known one", () => {
    expect(locate({ lat: 48.85, lng: 2.35 }).city).toBeNull();
  });
});

describe("near-me search", () => {
  it("limits results to the user's area, own neighborhood first", () => {
    const { results } = search({ ...EMPTY_INTENT, nearMe: "احمدآباد" });
    const area = areaAround("احمدآباد");
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) expect(area).toContain(r.listing.neighborhood);
    expect(results[0].listing.neighborhood).toBe("احمدآباد");
  });

  it("ignores near-me when the query names a neighborhood", () => {
    const named = { ...EMPTY_INTENT, neighborhoods: ["وکیل‌آباد" as const] };
    expect(search({ ...named, nearMe: "احمدآباد" }).total).toBe(search(named).total);
  });
});

describe("listingLatLng", () => {
  it("is stable and stays inside the listing's neighborhood", () => {
    const a = listingLatLng({ id: "dv-0901", neighborhood: "وکیل‌آباد" });
    expect(listingLatLng({ id: "dv-0901", neighborhood: "وکیل‌آباد" })).toEqual(a);
    expect(distanceKm(a, HOOD_CENTERS["وکیل‌آباد"])).toBeLessThan(1.2);
    expect(listingLatLng({ id: "dv-0902", neighborhood: "وکیل‌آباد" })).not.toEqual(a);
  });
});

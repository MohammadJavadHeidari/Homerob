import { describe, expect, it } from "vitest";

import { parseIntentWithRules } from "./intent/rules";
import { resolvePlace, searchCity } from "./intent/place";
import { EMPTY_INTENT } from "./intent/schema";
import { canonicalCity, findCity, findNeighborhoods } from "./places";
import { search } from "./search";
import { suggest } from "./search/suggest";
import type { Listing } from "./types";

describe("city names", () => {
  it("finds a city as a whole word", () => {
    expect(findCity("دوخوابه در تهران با ۲ میلیارد رهن")).toBe("تهران");
    expect(findCity("یه سوئیت تو قم")).toBe("قم");
    expect(findCity("رقم رهن ۵۰۰")).toBeNull(); // "قم" inside "رقم"
    expect(findCity("سوئیت در خرم آباد")).toBe("خرم‌آباد");
    expect(canonicalCity("طهران")).toBe("تهران");
  });

  it("only matches neighborhoods of the named city", () => {
    expect(findNeighborhoods("وکیل آباد", "مشهد")).toEqual(["وکیل‌آباد"]);
    expect(findNeighborhoods("وکیل آباد", "تهران")).toEqual([]);
  });
});

describe("resolvePlace", () => {
  it("fills the city from a named neighborhood", () => {
    expect(resolvePlace({ ...EMPTY_INTENT, neighborhoods: ["وکیل آباد"] })).toMatchObject({ city: "مشهد", neighborhoods: ["وکیل‌آباد"] });
  });

  it("drops neighborhoods and near-me outside the named city", () => {
    const r = resolvePlace({ ...EMPTY_INTENT, city: "تهران", neighborhoods: ["سجاد"], nearMe: "سجاد" });
    expect(r).toMatchObject({ city: "تهران", neighborhoods: [], nearMe: null });
  });

  it("limits the search to the user's own city when near-me is on", () => {
    expect(searchCity({ ...EMPTY_INTENT, nearMe: "سجاد" })).toBe("مشهد");
    expect(searchCity(EMPTY_INTENT)).toBeNull();
  });

  it("reads the city in the rule parser", () => {
    expect(resolvePlace(parseIntentWithRules("دوخوابه تهران رهن ۲ میلیارد")).city).toBe("تهران");
    expect(resolvePlace(parseIntentWithRules("دوخوابه وکیل‌آباد ۵۰۰ رهن")).city).toBe("مشهد");
  });
});

describe("multi-city search", () => {
  const tehran: Listing = {
    id: "t-1", source: "divar", title: "آپارتمان ۸۰ متری دوخوابه", city: "تهران", neighborhood: "پونک", street: "پونک",
    deposit: 1_000_000_000, monthlyRent: 20_000_000, areaM2: 80, rooms: 2, floor: 2, totalFloors: 5, buildingAge: 5,
    elevator: true, parking: true, storage: true, tags: [], convertible: true, description: "", postedAt: "2026-09-24T00:00:00Z",
  };
  const mashhad: Listing = { ...tehran, id: "m-1", city: "مشهد", neighborhood: "سجاد", street: "بلوار سجاد" };

  it("hard-filters by city", () => {
    const ids = (city: string | null) => search({ ...EMPTY_INTENT, city }, [tehran, mashhad]).results.map((r) => r.listing.id);
    expect(ids("تهران")).toEqual(["t-1"]);
    expect(ids("مشهد")).toEqual(["m-1"]);
    expect(ids(null).sort()).toEqual(["m-1", "t-1"]);
  });

  it("points to covered cities when the named one has no listings yet", () => {
    const s = suggest({ ...EMPTY_INTENT, city: "یزد" });
    expect(s?.text).toMatch(/^در مشهد [۰-۹]+ آگهی هست$/);
    expect(s?.intent.city).toBeNull();
  });
});

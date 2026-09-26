import { describe, expect, it } from "vitest";

import { locate } from "./geo";

describe("locate", () => {
  it("finds Mashhad and the nearest home-map pin", () => {
    const p = locate({ lat: 36.335, lng: 59.49 });
    expect(p).toMatchObject({ city: "مشهد", supported: true, neighborhood: "وکیل‌آباد", lat: 36.335, lng: 59.49 });
    expect(locate({ lat: 36.3, lng: 59.59 }).neighborhood).toBe("احمدآباد");
  });

  it("marks other cities supported only when they have listings", () => {
    expect(locate({ lat: 35.7, lng: 51.4 })).toMatchObject({ city: "تهران", supported: false, neighborhood: null });
    expect(locate({ lat: 35.7, lng: 51.4 }, ["مشهد", "تهران"]).supported).toBe(true);
  });

  it("returns no city far from any known one", () => {
    expect(locate({ lat: 48.85, lng: 2.35 }).city).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import shapes from "@/data/hood-shapes.json";
import { distanceKm } from "./geo";
import { hoodShape, inShape, shapeBounds, type Shape } from "./hood-shapes";
import { hoodInfo } from "./places";

describe("hood shapes", () => {
  const all = Object.entries(shapes as unknown as Record<string, Record<string, Shape>>).flatMap(([city, byHood]) =>
    Object.entries(byHood).map(([name, shape]) => ({ city, name, shape })),
  );

  it("covers the demo neighborhoods", () => {
    expect(hoodShape("ایثار", "مشهد")).not.toBeNull();
    expect(hoodShape("پورسینا", "مشهد")).not.toBeNull();
    expect(hoodShape("قاسم‌آباد", "مشهد")).toBeNull(); // no OSM boundary → circle fallback
  });

  it("only has registered neighborhoods, each a closed ring near its center", () => {
    expect(all.length).toBeGreaterThan(5);
    for (const { city, name, shape } of all) {
      const info = hoodInfo(name, city);
      expect(info, name).toBeDefined();
      for (const [outer] of shape) expect(outer[0]).toEqual(outer.at(-1));
      const [w, s, e, n] = shapeBounds(shape);
      const mid = { lat: (s + n) / 2, lng: (w + e) / 2 };
      expect(distanceKm(mid, info!.center), name).toBeLessThan(2.5);
    }
  });

  it("tells inside from outside", () => {
    const shape = hoodShape("ایثار", "مشهد")!;
    const [w, s, e, n] = shapeBounds(shape);
    expect(inShape([w - 0.01, s - 0.01], shape)).toBe(false);
    expect(inShape([e + 0.01, n + 0.01], shape)).toBe(false);
  });
});

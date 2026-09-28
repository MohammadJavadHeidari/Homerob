import { describe, expect, it } from "vitest";

import { focusArea } from "./focus-area";

const area = (names: string[]) => focusArea(names.map((name) => ({ name, city: "مشهد" })));
const kinds = (a: ReturnType<typeof focusArea>) => a.features.features.map((f) => f.properties?.kind);

describe("focusArea", () => {
  it("is empty when nothing is in focus", () => {
    expect(area([])).toMatchObject({ bounds: null, labels: [] });
  });

  it("outlines a real boundary as exact, with the city dimmed around it", () => {
    const a = area(["ایثار"]);
    expect(kinds(a)).toEqual(["mask", "area"]);
    expect(a.features.features[1].properties?.exact).toBe(true);
    expect(a.labels.map((l) => l.name)).toEqual(["ایثار"]);
  });

  it("merges touching neighborhoods into one outline", () => {
    const a = area(["ایثار", "گلشور", "طلاب"]);
    const merged = a.features.features[1].geometry as GeoJSON.MultiPolygon;
    expect(merged.coordinates.length).toBe(1);
    expect(a.labels).toHaveLength(3);
  });

  it("marks the outline approximate when a neighborhood has no boundary", () => {
    const a = area(["ایثار", "قاسم‌آباد"]);
    expect(a.features.features[1].properties?.exact).toBe(false);
  });
});

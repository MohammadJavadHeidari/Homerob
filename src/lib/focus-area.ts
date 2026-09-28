import { difference, union, type MultiPolygon, type Polygon } from "polygon-clipping";

import { hoodShape, shapeBounds, type Shape } from "@/lib/hood-shapes";
import { hoodCenter } from "@/lib/places";

/**
 * The map outline for the neighborhoods in focus, drawn the way Divar does it: the real boundary along
 * the streets (merged into one outline when neighborhoods touch), the rest of the map dimmed.
 * A neighborhood without a baked boundary falls back to a ~1.2 km circle and the outline is dashed,
 * so an approximate area never looks exact.
 */

export interface FocusHood {
  name: string;
  city?: string | null;
}

export interface FocusArea {
  /** GeoJSON: `kind` = "mask" (everything outside) | "area" (the merged neighborhoods, `exact` flag). */
  features: GeoJSON.FeatureCollection;
  /** [west, south, east, north] of the area; null when nothing is in focus. */
  bounds: [number, number, number, number] | null;
  /** One label per neighborhood, at the top edge of its own outline. */
  labels: { name: string; lng: number; lat: number }[];
}

const WORLD: Polygon = [
  [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ],
];

const EMPTY: FocusArea = { features: { type: "FeatureCollection", features: [] }, bounds: null, labels: [] };

function circle(c: { lat: number; lng: number }): Shape {
  const ring = Array.from({ length: 65 }, (_, i) => {
    const a = (i / 64) * 2 * Math.PI;
    return [c.lng + (0.0115 * Math.cos(a)) / Math.cos((c.lat * Math.PI) / 180), c.lat + 0.0115 * Math.sin(a)] as [number, number];
  });
  ring[64] = ring[0];
  return [[ring]];
}

export function focusArea(hoods: FocusHood[]): FocusArea {
  const parts = hoods.flatMap(({ name, city }) => {
    const exact = hoodShape(name, city);
    if (exact) return [{ name, shape: exact, exact: true }];
    const c = hoodCenter(name, city);
    return c ? [{ name, shape: circle(c), exact: false }] : [];
  });
  if (!parts.length) return EMPTY;

  const merged: MultiPolygon = union(...(parts.map((p) => p.shape) as [MultiPolygon, ...MultiPolygon[]]));
  const mask = difference(WORLD, merged);
  const exact = parts.every((p) => p.exact);

  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of parts) {
    const [pw, ps, pe, pn] = shapeBounds(p.shape);
    [w, s, e, n] = [Math.min(w, pw), Math.min(s, ps), Math.max(e, pe), Math.max(n, pn)];
  }

  const labels = parts.map(({ name, shape }) => {
    // the northmost vertex: the label sits on the outline like a tab, clear of the pins inside
    const top = shape.flatMap(([outer]) => outer).reduce((a, b) => (b[1] > a[1] ? b : a));
    return { name, lng: top[0], lat: top[1] };
  });

  return {
    features: {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { kind: "mask" }, geometry: { type: "MultiPolygon", coordinates: mask } },
        { type: "Feature", properties: { kind: "area", exact }, geometry: { type: "MultiPolygon", coordinates: merged } },
      ],
    },
    bounds: [w, s, e, n],
    labels,
  };
}

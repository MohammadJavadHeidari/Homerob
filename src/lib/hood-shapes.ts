import shapes from "@/data/hood-shapes.json";
import type { LatLng } from "@/lib/places";

/**
 * Real neighborhood boundaries (OpenStreetMap, ODbL) baked by `scripts/build-hood-shapes.mjs`.
 * Coordinates are GeoJSON order: [lng, lat]. Neighborhoods without an OSM boundary have no shape.
 */
export type Ring = [number, number][];
/** GeoJSON MultiPolygon coordinates: polygons → rings (first = outer) → points. */
export type Shape = Ring[][];

const SHAPES = shapes as unknown as Record<string, Record<string, Shape>>;

export function hoodShape(name: string, city?: string | null): Shape | null {
  if (city) return SHAPES[city]?.[name] ?? null;
  for (const byHood of Object.values(SHAPES)) if (byHood[name]) return byHood[name];
  return null;
}

export function inRing([x, y]: [number, number], ring: Ring): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Inside an outer ring and none of its holes. */
export function inShape(p: [number, number], shape: Shape): boolean {
  return shape.some(([outer, ...holes]) => inRing(p, outer) && !holes.some((h) => inRing(p, h)));
}

/** [west, south, east, north] of every outer ring. */
export function shapeBounds(shape: Shape): [number, number, number, number] {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [outer] of shape)
    for (const [x, y] of outer) {
      w = Math.min(w, x);
      e = Math.max(e, x);
      s = Math.min(s, y);
      n = Math.max(n, y);
    }
  return [w, s, e, n];
}

/**
 * A stable point well inside the shape for two numbers in [0, 1): walks a seeded sequence over the
 * bounding box until a point lands inside the shape shrunk ~15% toward its center, so derived pins
 * never sit on (or over) the drawn boundary. Null only for degenerate shapes.
 */
export function pointInShape(shape: Shape, u: number, v: number, fallback: LatLng): LatLng | null {
  const [w, s, e, n] = shapeBounds(shape);
  const c: [number, number] = [fallback.lng, fallback.lat];
  const anchor = inShape(c, shape) ? c : [(w + e) / 2, (s + n) / 2];
  for (let k = 0; k < 200; k++) {
    // golden-ratio steps from the seed: evenly spread, deterministic
    const x = w + (e - w) * ((u + k * 0.6180339887) % 1);
    const y = s + (n - s) * ((v + k * 0.7548776662) % 1);
    const out: [number, number] = [anchor[0] + (x - anchor[0]) / 0.85, anchor[1] + (y - anchor[1]) / 0.85];
    if (inShape([x, y], shape) && inShape(out, shape)) return { lat: y, lng: x };
  }
  return null;
}

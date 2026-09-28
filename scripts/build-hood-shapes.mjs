// Bakes real neighborhood boundaries (the polygons Divar-style maps outline along the streets) from
// OpenStreetMap, for the "neighborhoods in focus" outline on the results map.
//
// Source: Overpass API (OpenStreetMap, ODbL). Mashhad's municipal neighborhoods are mapped there as
// boundary=administrative + admin_level=11 relations whose edges follow the streets.
// Usage: node scripts/build-hood-shapes.mjs [cacheDir]
//   cacheDir (optional): keeps each city's raw Overpass answer, so re-runs don't hit the network.
// Output: src/data/hood-shapes.json — { city: { neighborhood: MultiPolygon coordinates } }.
//
// A registered neighborhood (HOODS in src/lib/places.ts) gets a shape only when an OSM boundary has its
// name (or an alias) AND lies near its registered center; the rest keep the map's circle fallback.
// Divar's districts don't always match OSM's municipal neighborhoods: DIVAR_TRACED holds Divar's own
// outline for a district (traced from its map) and wins over OSM.
// Re-run after adding a city or neighborhood to HOODS.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const HEADERS = { "User-Agent": "homerob-build/1.0 (github.com/MohammadJavadHeidari/Homerob)", Accept: "application/json" };
/** Degrees around the outermost neighborhood centers (~3.5 km). */
const MARGIN = 0.035;
/** A same-name boundary farther than this from the registered center is another place. */
const MAX_KM = 2.5;
/**
 * Divar's own outline of a district, [lng, lat] corners, traced from divar.ir's map with the district
 * selected (the URL's bbox pins the extent: the corners touch its four sides). Captured by the owner.
 *   طلاب: divar.ir/s/mashhad/rent-residential/tollab, bbox 59.6324196,36.2930908,59.6541748,36.310451 (2026-09-28)
 */
const DIVAR_TRACED = {
  مشهد: {
    طلاب: [
      [59.64668, 36.31045],
      [59.65417, 36.30184],
      [59.64076, 36.29309],
      [59.63242, 36.30206],
    ],
  },
};
/** Douglas–Peucker tolerance in degrees (~8 m): keeps street corners, drops GPS noise. */
const SIMPLIFY = 0.00008;

// HOODS lives in a TS file; pull name/city/center/aliases out with a regex instead of a TS toolchain.
const src = readFileSync(new URL("../src/lib/places.ts", import.meta.url), "utf8");
const hoods = [
  ...src.matchAll(/name: "([^"]+)",\s*city: "([^"]+)",\s*center: \{ lat: ([\d.]+), lng: ([\d.]+) \},\s*aliases: \[([^\]]*)\]/g),
].map(([, name, city, lat, lng, aliases]) => ({
  name,
  city,
  lat: +lat,
  lng: +lng,
  aliases: [...aliases.matchAll(/"([^"]+)"/g)].map((m) => m[1]),
}));
if (!hoods.length) throw new Error("no HOODS found in places.ts");

const cities = new Map();
for (const h of hoods) cities.set(h.city, [...(cities.get(h.city) ?? []), h]);

const norm = (s) =>
  s
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\s‌‏-]/g, "")
    .trim();

function query([s, w, n, e]) {
  const box = `(${s},${w},${n},${e})`;
  return `[out:json][timeout:120];
(
  relation["boundary"="administrative"]["admin_level"~"^(10|11)$"]${box};
  relation["place"~"^(neighbourhood|suburb|quarter)$"]${box};
);
out geom;`;
}

async function overpass(q) {
  // public mirrors are often busy (503/504): a few rounds with a pause
  for (let round = 0; round < 4; round++) {
    if (round) await new Promise((r) => setTimeout(r, 15_000 * round));
    const data = await tryEndpoints(q);
    if (data) return data;
  }
  throw new Error("every Overpass endpoint failed");
}

async function tryEndpoints(q) {
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, { method: "POST", headers: HEADERS, body: new URLSearchParams({ data: q }), signal: AbortSignal.timeout(150_000) });
      const text = await res.text();
      if (!res.ok || !text.startsWith("{")) throw new Error(`HTTP ${res.status}`);
      return JSON.parse(text);
    } catch (err) {
      console.warn(`  ${url} failed: ${err.message}`);
    }
  }
  return null;
}

const key = (p) => `${p[0].toFixed(7)},${p[1].toFixed(7)}`;

/** Joins a relation's outer ways end to end into closed rings. */
function rings(rel) {
  const pieces = rel.members
    .filter((m) => m.type === "way" && m.role !== "inner" && m.geometry?.length > 1)
    .map((m) => m.geometry.map((g) => [g.lon, g.lat]));
  const out = [];
  while (pieces.length) {
    let ring = pieces.shift();
    for (let guard = 0; key(ring[0]) !== key(ring.at(-1)) && guard < 10_000; guard++) {
      const end = key(ring.at(-1));
      const i = pieces.findIndex((p) => key(p[0]) === end || key(p.at(-1)) === end);
      if (i < 0) break;
      const [next] = pieces.splice(i, 1);
      ring = ring.concat((key(next[0]) === end ? next : next.reverse()).slice(1));
    }
    if (key(ring[0]) === key(ring.at(-1)) && ring.length >= 4) out.push(ring);
  }
  return out;
}

function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-12;
    let far = -1;
    let best = tol;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > best) {
        best = d;
        far = i;
      }
    }
    if (far >= 0) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Closed ring: simplify the open path, then close it again. */
const tidy = (ring) => {
  const s = simplify(ring.slice(0, -1).concat([ring[0]]), SIMPLIFY).map(([x, y]) => [+x.toFixed(5), +y.toFixed(5)]);
  return s.length >= 4 ? s : ring;
};

function area(ring) {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return a / 2;
}

function inside([x, y], ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function km(a, b) {
  const dx = (a[0] - b[0]) * 111.32 * Math.cos((a[1] * Math.PI) / 180);
  const dy = (a[1] - b[1]) * 110.57;
  return Math.hypot(dx, dy);
}

function centroid(ring) {
  const n = ring.length - 1;
  return [ring.slice(0, n).reduce((s, p) => s + p[0], 0) / n, ring.slice(0, n).reduce((s, p) => s + p[1], 0) / n];
}

const cacheDir = process.argv[2];
if (cacheDir) mkdirSync(cacheDir, { recursive: true });

const out = {};
for (const [city, hs] of cities) {
  const s = Math.min(...hs.map((h) => h.lat)) - MARGIN;
  const n = Math.max(...hs.map((h) => h.lat)) + MARGIN;
  const w = Math.min(...hs.map((h) => h.lng)) - MARGIN;
  const e = Math.max(...hs.map((h) => h.lng)) + MARGIN;
  const cache = cacheDir && `${cacheDir}/hood-shapes-${city}.json`;
  let data;
  if (cache && existsSync(cache)) data = JSON.parse(readFileSync(cache, "utf8"));
  else {
    console.log(`${city}: querying Overpass…`);
    data = await overpass(query([s, w, n, e]));
    if (cache) writeFileSync(cache, JSON.stringify(data));
  }
  const rels = data.elements.filter((el) => el.type === "relation" && el.tags?.name);
  console.log(`${city}: ${rels.length} boundaries in the box`);

  for (const h of hs) {
    const center = [h.lng, h.lat];
    const traced = DIVAR_TRACED[city]?.[h.name];
    if (traced) {
      const ring = [...traced, traced[0]];
      (out[city] ??= {})[h.name] = [[area(ring) < 0 ? ring.reverse() : ring]];
      console.log(`  ✓ ${h.name} ← Divar's outline (traced, ${traced.length} corners)`);
      continue;
    }
    const names = new Set([h.name, ...h.aliases].map(norm));
    const candidates = rels
      .filter((r) => names.has(norm(r.tags.name)))
      .map((r) => {
        const polys = rings(r);
        if (!polys.length) return null;
        const holds = polys.some((ring) => inside(center, ring));
        const dist = Math.min(...polys.map((ring) => km(centroid(ring), center)));
        return { r, polys, holds, dist };
      })
      .filter((c) => c && (c.holds || c.dist <= MAX_KM))
      // prefer the neighborhood level (11) and the one holding the registered center
      .sort((a, b) => +b.holds - +a.holds || (b.r.tags.admin_level === "11") - (a.r.tags.admin_level === "11") || a.dist - b.dist);
    const best = candidates[0];
    if (!best) {
      console.log(`  ✗ ${h.name}: no OSM boundary with this name nearby (circle fallback)`);
      continue;
    }
    // CCW outer rings (GeoJSON right-hand rule); one polygon per ring, largest first
    const polys = best.polys
      .map(tidy)
      .map((ring) => (area(ring) < 0 ? ring.reverse() : ring))
      .sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)))
      .map((ring) => [ring]);
    (out[city] ??= {})[h.name] = polys;
    const pts = polys.reduce((s, p) => s + p[0].length, 0);
    console.log(`  ✓ ${h.name} ← relation ${best.r.id} «${best.r.tags.name}» (${pts} points${best.holds ? "" : `, center ${best.dist.toFixed(1)} km away`})`);
  }
}

const path = new URL("../src/data/hood-shapes.json", import.meta.url);
writeFileSync(path, JSON.stringify(out) + "\n");
console.log(`wrote ${path.pathname}`);

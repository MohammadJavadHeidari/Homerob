// Bakes the metro / light-rail lines of every covered city (line number, color, ends, ordered
// stations) from OpenStreetMap, for "which metro line?" in search.
//
// Source: Overpass API (OpenStreetMap, ODbL). Only lines in service (route=subway|light_rail);
// lines under construction or proposed are skipped, and so are stops tagged inactive.
// Usage: node scripts/build-metro.mjs [cacheDir]
// Output: src/data/metro.json — read by src/lib/metro.ts.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const ENDPOINTS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
/** Degrees around the city center (~30 km): enough for a whole metro network. */
const RADIUS = 0.3;
/** A stop without a name takes the nearest named station within this many meters. */
const NAME_RADIUS_M = 400;

// Covered cities = cities with neighborhoods in HOODS; centers from CITIES. Regex, no TS toolchain.
const src = readFileSync(new URL("../src/lib/places.ts", import.meta.url), "utf8");
const covered = new Set([...src.matchAll(/name: "[^"]+",\s*city: "([^"]+)",\s*center:/g)].map(([, c]) => c));
const centers = new Map([...src.matchAll(/city\("([^"]+)", ([\d.]+), ([\d.]+)\)/g)].map(([, c, lat, lng]) => [c, [+lat, +lng]]));
if (!covered.size) throw new Error("no HOODS found in places.ts");

async function overpass(q) {
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, { method: "POST", body: new URLSearchParams({ data: q }), signal: AbortSignal.timeout(150_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`  ${url} failed: ${err.message}`);
    }
  }
  throw new Error("every Overpass endpoint failed");
}

const query = ([s, w, n, e]) => {
  const box = `(${s},${w},${n},${e})`;
  return `[out:json][timeout:120];
relation["route"~"^(subway|light_rail)$"]${box}->.r;
.r out body;
node(r.r);
out body;
node["railway"~"^(station|halt)$"]${box};
out body;`;
};

const meters = (a, b) => {
  const k = Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot((a.lat - b.lat) * 111_320, (a.lng - b.lng) * 111_320 * k);
};

/** «ایستگاه مترو کوثر» / «مترو طبرسی» → «کوثر». */
const clean = (name) =>
  name
    ?.replace(/^\s*(ایستگاه\s+)?(مترو|قطار شهری)\s+/, "")
    .replace(/^\s*ایستگاه\s+/, "")
    .replace(/ آباد(?=\s|$)/g, "\u200cآباد") // «وکیل آباد» → «وکیل‌آباد», as in HOODS
    .trim() || null;

const persianDigits = (s) => s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);

function linesOf(json) {
  const nodes = new Map(json.elements.filter((e) => e.type === "node").map((e) => [e.id, e]));
  const named = [...nodes.values()]
    .filter((n) => n.tags?.railway && clean(n.tags.name))
    .map((n) => ({ name: clean(n.tags.name), lat: n.lat, lng: n.lon }));
  const relations = json.elements.filter((e) => e.type === "relation" && e.tags?.ref);

  // One direction per line is enough (the other is the same stations reversed); keep the longest.
  const byRef = new Map();
  for (const r of relations) {
    const stops = r.members.filter((m) => m.type === "node" && /^stop(_entry_only|_exit_only)?$/.test(m.role) && nodes.has(m.ref));
    if (stops.length < 2) continue;
    const prev = byRef.get(r.tags.ref);
    if (!prev || stops.length > prev.stops.length) byRef.set(r.tags.ref, { r, stops });
  }

  return [...byRef.values()]
    .map(({ r, stops }) => {
      const stations = stops.map((m, i) => {
        const n = nodes.get(m.ref);
        const at = { lat: +n.lat.toFixed(5), lng: +n.lon.toFixed(5) };
        let name = clean(n.tags?.name);
        if (!name) {
          const near = named.map((s) => ({ s, d: meters(s, at) })).sort((a, b) => a.d - b.d)[0];
          if (near && near.d <= NAME_RADIUS_M) name = near.s.name;
        }
        // terminals without a named station nearby: the line's own from/to
        if (!name && i === 0) name = clean(r.tags.from);
        if (!name && i === stops.length - 1) name = clean(r.tags.to);
        return { n: name ?? "", ...at };
      });
      // drop consecutive duplicates (a stop_position and its platform sharing a name)
      const unique = stations.filter((s, i) => !s.n || s.n !== stations[i - 1]?.n);
      return {
        ref: r.tags.ref,
        name: `خط ${persianDigits(r.tags.ref)}`,
        colour: r.tags.colour ?? null,
        from: unique[0].n,
        to: unique.at(-1).n,
        stations: unique,
      };
    })
    .sort((a, b) => a.ref.localeCompare(b.ref, "en", { numeric: true }));
}

const cacheDir = process.argv[2];
if (cacheDir && !existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });

const out = { source: "© OpenStreetMap contributors (ODbL), via Overpass API", builtAt: new Date().toISOString(), cities: {} };
for (const city of covered) {
  const c = centers.get(city);
  if (!c) throw new Error(`no center for ${city} in CITIES`);
  const box = [c[0] - RADIUS, c[1] - RADIUS, c[0] + RADIUS, c[1] + RADIUS].map((x) => +x.toFixed(3));
  const cached = cacheDir && `${cacheDir}/metro-${city}.json`;
  let json;
  if (cached && existsSync(cached)) json = JSON.parse(readFileSync(cached, "utf8"));
  else {
    console.log(`${city}: querying Overpass…`);
    json = await overpass(query(box));
    if (cached) writeFileSync(cached, JSON.stringify(json));
  }
  const lines = linesOf(json);
  const unnamed = lines.flatMap((l) => l.stations.filter((s) => !s.n).map(() => l.ref));
  if (unnamed.length) console.warn(`  ${city}: ${unnamed.length} unnamed stops on lines ${[...new Set(unnamed)].join(", ")}`);
  for (const l of lines) console.log(`  ${city} ${l.name}: ${l.from} ↔ ${l.to}, ${l.stations.length} stations`);
  if (lines.length) out.cities[city] = lines;
}

writeFileSync(new URL("../src/data/metro.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.log("wrote src/data/metro.json");

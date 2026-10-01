// Bakes real places around the covered neighborhoods (supermarkets, clinics, stations, …) from
// OpenStreetMap, for the "neighborhood advantages" section of a listing.
//
// Source: Overpass API (OpenStreetMap, ODbL). Tries a few public endpoints in order.
// Usage: node scripts/build-nearby.mjs [cacheDir]
//   cacheDir (optional): keeps each city's raw Overpass answer, so re-runs don't hit the network.
// Output: src/data/pois.json  — server-side only, read by src/lib/nearby.
//
// Every covered city gets one query over the box around its neighborhoods (+ MARGIN). Re-run after
// adding a city or neighborhood to HOODS in src/lib/places.ts.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
/** Degrees around the outermost neighborhood centers (~3.5 km). */
const MARGIN = 0.035;

// HOODS lives in a TS file; pull name/city/center out with a regex instead of a TS toolchain.
const src = readFileSync(new URL("../src/lib/places.ts", import.meta.url), "utf8");
const hoods = [...src.matchAll(/name: "([^"]+)",\s*city: "([^"]+)",\s*center: \{ lat: ([\d.]+), lng: ([\d.]+) \}/g)].map(
  ([, name, city, lat, lng]) => ({ name, city, lat: +lat, lng: +lng }),
);
// …plus the districts the crawl import registered on its own (src/data/auto-hoods.json).
const autoFile = new URL("../src/data/auto-hoods.json", import.meta.url);
if (existsSync(autoFile)) {
  for (const h of JSON.parse(readFileSync(autoFile, "utf8"))) hoods.push({ name: h.name, city: h.city, lat: h.center.lat, lng: h.center.lng });
}
if (!hoods.length) throw new Error("no HOODS found in places.ts");

const cities = new Map();
for (const h of hoods) cities.set(h.city, [...(cities.get(h.city) ?? []), h]);

// [category, overpass selectors]. Ways/relations come back as their center point.
const SELECTORS = [
  ["supermarket", ['nwr["shop"~"^(supermarket|convenience|hypermarket)$"]']],
  ["bakery", ['nwr["shop"="bakery"]']],
  ["pharmacy", ['nwr["amenity"="pharmacy"]']],
  ["clinic", ['nwr["amenity"~"^(clinic|doctors)$"]', 'nwr["healthcare"="clinic"]']],
  ["hospital", ['nwr["amenity"="hospital"]']],
  ["gym", ['nwr["leisure"~"^(fitness_centre|sports_centre)$"]']],
  ["mosque", ['nwr["amenity"="place_of_worship"]["religion"="muslim"]']],
  ["park", ['nwr["leisure"="park"]']],
  ["school", ['nwr["amenity"="school"]']],
  ["bus", ['node["highway"="bus_stop"]', 'node["public_transport"="platform"]["bus"="yes"]']],
  ["rail", ['node["railway"~"^(station|halt|tram_stop)$"]', 'node["public_transport"="station"]["train"!="yes"]']],
];

function query([s, w, n, e]) {
  const box = `(${s},${w},${n},${e})`;
  const parts = SELECTORS.flatMap(([, sels]) => sels.map((x) => `${x}${box};`)).join("\n");
  return `[out:json][timeout:120];\n(\n${parts}\n);\nout center tags;`;
}

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

const matches = (t, cat) => {
  switch (cat) {
    case "supermarket":
      return /^(supermarket|convenience|hypermarket)$/.test(t.shop ?? "");
    case "bakery":
      return t.shop === "bakery";
    case "pharmacy":
      return t.amenity === "pharmacy";
    case "clinic":
      return /^(clinic|doctors)$/.test(t.amenity ?? "") || t.healthcare === "clinic";
    case "hospital":
      return t.amenity === "hospital";
    case "gym":
      return /^(fitness_centre|sports_centre)$/.test(t.leisure ?? "");
    case "mosque":
      return t.amenity === "place_of_worship" && t.religion === "muslim";
    case "park":
      return t.leisure === "park";
    case "school":
      return t.amenity === "school";
    case "bus":
      return t.highway === "bus_stop" || (t.public_transport === "platform" && t.bus === "yes");
    case "rail":
      return /^(station|halt|tram_stop)$/.test(t.railway ?? "") || (t.public_transport === "station" && t.train !== "yes");
  }
  return false;
};

const round = (x) => Math.round(x * 1e5) / 1e5;
const is24h = (t) => /24\/7|24 ?h|شبانه/i.test(`${t.opening_hours ?? ""} ${t.name ?? ""}`);
// "حمام عمومی", "مسجد" with no name etc. stay nameless; keep only Persian (or English) names.
const nameOf = (t) => (t["name:fa"] ?? t.name ?? t["name:en"] ?? "").trim().slice(0, 60) || undefined;

/**
 * Clean-up of real OSM tags (never invents places): vets aren't clinics, fruit stands aren't
 * supermarkets, a "hospital" without «بیمارستان» in its name is a clinic, doctors' offices only
 * count when they're named as a clinic, and a bus stop mis-tagged as a station isn't the metro.
 */
function categorize(cat, t) {
  const name = nameOf(t) ?? "";
  if (/دامپزشک|حیوان|veterin/i.test(name) || t.amenity === "veterinary") return null;
  switch (cat) {
    case "supermarket":
      return /میوه|تره ?بار|آنلاین/.test(name) ? null : cat;
    case "hospital":
      return /بیمارستان|hospital/i.test(name) ? cat : /درمانگاه|کلینیک|clinic/i.test(name) ? "clinic" : null;
    case "clinic":
      if (t.amenity === "doctors" && !/درمانگاه|کلینیک|clinic|مرکز/i.test(name)) return null;
      return /^(مطب|دکتر|دكتور)/.test(name) ? null : cat;
    case "rail":
      return /اتوبوس/.test(name) ? null : cat;
  }
  return cat;
}

const out = { source: "© OpenStreetMap contributors (ODbL), via Overpass API", builtAt: new Date().toISOString(), cities: {} };
for (const [city, hs] of cities) {
  const s = Math.min(...hs.map((h) => h.lat)) - MARGIN;
  const n = Math.max(...hs.map((h) => h.lat)) + MARGIN;
  const w = Math.min(...hs.map((h) => h.lng)) - MARGIN;
  const e = Math.max(...hs.map((h) => h.lng)) + MARGIN;
  console.log(`${city}: box ${[s, w, n, e].map((x) => x.toFixed(3)).join(",")}`);
  const cacheDir = process.argv[2];
  const cached = cacheDir && `${cacheDir}/overpass-${[s, w, n, e].map((x) => x.toFixed(3)).join("_")}.json`;
  let json;
  if (cached && existsSync(cached)) json = JSON.parse(readFileSync(cached, "utf8"));
  else {
    json = await overpass(query([s, w, n, e]));
    if (cached) {
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(cached, JSON.stringify(json));
    }
  }
  const seen = new Set();
  const pois = [];
  for (const el of json.elements) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;
    const t = el.tags ?? {};
    for (const [tagCat] of SELECTORS) {
      if (!matches(t, tagCat)) continue;
      const cat = categorize(tagCat, t);
      if (!cat) continue;
      const key = `${cat}:${round(lat)}:${round(lng)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const p = { c: cat, lat: round(lat), lng: round(lng) };
      const name = nameOf(t);
      if (name) p.n = name;
      if (is24h(t)) p.h24 = 1;
      pois.push(p);
    }
  }
  const counts = Object.fromEntries(SELECTORS.map(([c]) => [c, pois.filter((p) => p.c === c).length]));
  console.log(`  ${pois.length} places`, counts);
  out.cities[city] = pois;
}

writeFileSync(new URL("../src/data/pois.json", import.meta.url), JSON.stringify(out));
console.log("wrote src/data/pois.json");

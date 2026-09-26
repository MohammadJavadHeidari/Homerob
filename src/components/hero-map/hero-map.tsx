"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { PlaceStatus } from "@/components/use-user-place";
import type { UserPlace } from "@/lib/geo";
import type { CityStat, HoodStat } from "@/lib/hood-stats";
import { formatToman, toFaDigits } from "@/lib/persian";
import { cityInfo, hoodsIn, isCovered } from "@/lib/places";
import { cn } from "@/lib/utils";

import { clamp01, easeInOutCubic, easeOutCubic, fitBox, interpolateZoom, type Box, type Camera } from "./camera";
import { MASHHAD_BOX, SHRINE } from "./hoods-data";
import { CITIES, IRAN_BOX, PROJ, PROVINCES } from "./iran-data";

// Timeline (ms from mount).
const STAGGER = 38;
const LOCATE_AT = 2300;
const FLY_AT = 4500;
const FLY_MS = 3700;
const CITY_AT = FLY_AT + FLY_MS;
const ROADS_FROM = FLY_AT + FLY_MS * 0.6;
const ROADS_MS = 2600;
const CYCLE_MS = 2800;

type Phase = "iran" | "locate" | "fly" | "city";
type Place =
  | { kind: "pending" }
  | { kind: "unknown" }
  /** A city Homerob has listings for. */
  | { kind: "covered"; city: string; hood?: string | null }
  | { kind: "other"; fa: string; x?: number; y?: number };

interface Roads {
  major: string;
  minor: string;
}

const project = (lat: number, lon: number) => ({
  x: (lon - PROJ.lon0) * PROJ.k * PROJ.cos,
  y: (PROJ.lat0 - lat) * PROJ.k,
});

/** Province outline to highlight for each city with listings (geoBoundaries names). */
const PROVINCE_OF: Record<string, string> = {
  "مشهد": "Razavi Khorasan",
  "تهران": "Tehran",
  "کرج": "Alborz",
  "اصفهان": "Isfahan",
  "شیراز": "Fars",
  "تبریز": "East Azerbaijan",
  "قم": "Qom",
  "اهواز": "Khuzestan",
};

interface Target {
  fa: string;
  x: number;
  y: number;
  /** Where the city camera lands. */
  box: Box;
  hoods: { fa: string; x: number; y: number }[];
}

/** The city the camera flies into: its neighborhood pins and a box around them. */
function targetOf(fa: string): Target {
  const c = CITIES.find((x) => x.fa === fa);
  const center = cityInfo(fa)?.center;
  const p = c ?? (center ? project(center.lat, center.lng) : { x: IRAN_BOX.x + IRAN_BOX.w / 2, y: IRAN_BOX.y + IRAN_BOX.h / 2 });
  const hoods = hoodsIn(fa).map((h) => ({ fa: h.name, ...project(h.center.lat, h.center.lng) }));
  if (fa === "مشهد") return { fa, x: p.x, y: p.y, box: MASHHAD_BOX, hoods };
  const xs = [p.x, ...hoods.map((h) => h.x)];
  const ys = [p.y, ...hoods.map((h) => h.y)];
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  // same scale as Mashhad's box so every city lands at a similar zoom
  const w = Math.max(x1 - x0 + 4, MASHHAD_BOX.w);
  const h = Math.max(y1 - y0 + 3, MASHHAD_BOX.h);
  return { fa, x: p.x, y: p.y, box: { x: (x0 + x1 - w) / 2, y: (y0 + y1 - h) / 2, w, h }, hoods };
}

/** The intro plays once per page load; coming back from results jumps straight to the city. */
let played = false;

/** Browser location (from useUserPlace) → map place. */
function fromUserPlace(p: UserPlace): Place {
  if (p.supported && p.city) return { kind: "covered", city: p.city, hood: p.neighborhood };
  if (!p.city) return { kind: "unknown" };
  const city = CITIES.find((c) => c.fa === p.city);
  return { kind: "other", fa: p.city, x: city?.x, y: city?.y };
}

/**
 * Fallback when the browser location is denied or still pending: `?city=` (for recording behind a
 * VPN, wins over everything) or Vercel's IP geolocation.
 */
async function locateFallback(override: string | null): Promise<Place> {
  let geo: { country?: string | null; city?: string | null; lat?: number | null; lon?: number | null } = {};
  if (override) geo = { country: "IR", city: override };
  else {
    try {
      const res = await fetch("/api/geo", { cache: "no-store" });
      if (res.ok) geo = await res.json();
    } catch {
      /* offline or blocked — fall through to unknown */
    }
  }
  if (geo.country !== "IR") return { kind: "unknown" };
  const name = geo.city?.trim().toLowerCase();
  const city = CITIES.find((c) => c.en.toLowerCase() === name || c.fa === geo.city);
  if (city && isCovered(city.fa)) return { kind: "covered", city: city.fa };
  if (city) return { kind: "other", fa: city.fa, x: city.x, y: city.y };
  if (geo.lat != null && geo.lon != null) return { kind: "other", fa: "شهر شما", ...project(geo.lat, geo.lon) };
  return { kind: "unknown" };
}

/**
 * Live background for the home page: Iran's provinces draw themselves in gold, the map finds
 * the visitor, then the camera flies into their city (or the city with the most listings when
 * theirs has none yet) where the neighborhoods light up with their listing counts.
 * Pure SVG + a rAF camera (viewBox), no map library or tiles.
 */
export function HeroMap({
  stats,
  placeStatus,
  place: userPlace,
  className,
}: {
  stats: { total: number; cities: CityStat[]; hoods: HoodStat[] };
  placeStatus: PlaceStatus;
  place: UserPlace | null;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const maskRef = useRef<SVGCircleElement>(null);
  const [phase, setPhase] = useState<Phase>("iran");
  const [fallback, setFallback] = useState<{ place: Place; override: boolean }>({ place: { kind: "pending" }, override: false });
  const mine = useRef(-1);
  const [roads, setRoads] = useState<Roads | null>(null);
  const [active, setActive] = useState(0);

  const targetRef = useRef<Target | null>(null);

  useEffect(() => {
    let alive = true;
    const override = new URLSearchParams(window.location.search).get("city");
    void locateFallback(override).then((p) => alive && setFallback({ place: p, override: Boolean(override) }));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    if (!root || !svg) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const skip = reduce || played;
    if (skip) root.dataset.skip = "";
    let t0 = -1;
    let blocks: DOMRect[] = [];
    let blocksAt = -1e9;
    let current: Phase = "iran";
    let raf = 0;

    const frame = (now: number) => {
      if (t0 < 0) t0 = now - (skip ? CITY_AT + 600 : 0);
      const t = now - t0;
      const vw = root.clientWidth || window.innerWidth;
      const vh = root.clientHeight || window.innerHeight;
      const narrow = vw < 640;

      const iran = fitBox(IRAN_BOX, vw, vh, narrow ? 0.06 : 0.16);
      const push = 1 - 0.06 * easeOutCubic(clamp01(t / FLY_AT));
      const iranCam: Camera = [iran[0], iran[1], iran[2] * push];
      // Keep the city a bit below center on phones, where the search box sits on top of it.
      // Desktop: zoom in past the fit so the neighborhoods spread around the centered content.
      const box = targetRef.current?.box ?? MASHHAD_BOX;
      const cityFit = fitBox(box, vw, narrow ? vh * 0.7 : vh, narrow ? 0.02 : -0.15);
      const cityCam: Camera = narrow
        ? [cityFit[0], cityFit[1] - (vh * 0.12 * cityFit[2]) / vw, cityFit[2]]
        : [cityFit[0] - cityFit[2] * 0.03, cityFit[1] - (vh * 0.04 * cityFit[2]) / vw, cityFit[2]];

      let cam: Camera;
      if (t < FLY_AT) cam = iranCam;
      else if (t < CITY_AT) cam = interpolateZoom(iranCam, cityCam)(easeInOutCubic((t - FLY_AT) / FLY_MS));
      else {
        const s = reduce ? 0 : (t - CITY_AT) / 1000;
        const fade = clamp01(s / 3);
        cam = [
          cityCam[0] + Math.sin(s / 7) * cityCam[2] * 0.025 * fade,
          cityCam[1] + Math.sin(s / 9 + 1) * cityCam[2] * 0.015 * fade,
          cityCam[2] * (1 - 0.04 * Math.sin(s / 11) * fade),
        ];
      }

      const [cx, cy, w] = cam;
      const u = w / vw;
      const h = vh * u;
      const vx = cx - w / 2;
      const vy = cy - h / 2;
      svg.setAttribute("viewBox", `${vx} ${vy} ${w} ${h}`);
      svg.style.setProperty("--u", String(u));

      const reveal = easeInOutCubic(clamp01((t - ROADS_FROM) / ROADS_MS));
      maskRef.current?.setAttribute("r", String(reveal * box.w * 1.4));

      // Page content marked with data-hero-block hides the cards that would sit under it.
      if (now - blocksAt > 400) {
        blocksAt = now;
        blocks = [...document.querySelectorAll("[data-hero-block]")].map((b) => b.getBoundingClientRect());
      }
      for (const el of root.querySelectorAll<HTMLElement>("[data-x]")) {
        const x = (Number(el.dataset.x) - vx) / u;
        const y = (Number(el.dataset.y) - vy) / u;
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        const covered = blocks.some((r) => x > r.left - 55 && x < r.right + 55 && y > r.top - 5 && y < r.bottom + 70);
        if (covered !== "covered" in el.dataset) el.toggleAttribute("data-covered", covered);
      }

      const next: Phase = t < LOCATE_AT ? "iran" : t < FLY_AT ? "locate" : t < CITY_AT ? "fly" : "city";
      if (next !== current) {
        current = next;
        if (next === "city") {
          played = true;
          if (mine.current >= 0) setActive(mine.current);
        }
        setPhase(next);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      played = true;
    };
  }, []);

  const after = (p: Phase) => ["iran", "locate", "fly", "city"].indexOf(phase) >= ["iran", "locate", "fly", "city"].indexOf(p);
  // Browser location wins; the IP fallback covers "denied" and a permission prompt left unanswered.
  const waiting = placeStatus === "idle" || placeStatus === "locating";
  const place: Place = fallback.override
    ? fallback.place
    : placeStatus === "found" && userPlace
      ? fromUserPlace(userPlace)
      : waiting && !after("fly")
        ? { kind: "pending" }
        : fallback.place;

  // The visitor's city when it has listings, else the city with the most listings. Locked once the
  // camera starts flying, so a late location answer can't yank it elsewhere.
  const wanted = place.kind === "covered" ? place.city : (stats.cities[0]?.city ?? "مشهد");
  const [locked, setLocked] = useState<string | null>(null);
  const flying = after("fly");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lock the destination when the flight starts
    if (flying && !locked) setLocked(wanted);
  }, [flying, locked, wanted]);
  const target = useMemo(() => targetOf(locked ?? wanted), [locked, wanted]);
  useEffect(() => {
    targetRef.current = target;
  }, [target]);
  useEffect(() => {
    if (target.fa !== "مشهد") return;
    let alive = true;
    void import("./mashhad-data").then((m) => alive && setRoads(m.MASHHAD_ROADS));
    return () => {
      alive = false;
    };
  }, [target.fa]);
  const cityCount = stats.cities.find((c) => c.city === target.fa)?.count ?? 0;

  useEffect(() => {
    if (phase !== "city" || !target.hoods.length) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % target.hoods.length), CYCLE_MS);
    return () => window.clearInterval(id);
  }, [phase, target]);

  const myHood = place.kind === "covered" && place.city === target.fa ? (place.hood ?? null) : null;
  const statFor = (hood: string) => stats.hoods.find((s) => s.city === target.fa && s.hood === hood);
  useEffect(() => {
    mine.current = myHood ? target.hoods.findIndex((h) => h.fa === myHood) : -1;
  }, [myHood, target]);
  const other = place.kind === "other" && place.x != null && place.y != null ? { fa: place.fa, x: place.x, y: place.y } : null;
  const arc = other
    ? `M${other.x} ${other.y}Q${(other.x + target.x) / 2} ${Math.min(other.y, target.y) - 160} ${target.x} ${target.y}`
    : null;

  const hud =
    phase === "iran"
      ? `ایران · ${toFaDigits(PROVINCES.length)} استان`
      : phase === "locate"
        ? place.kind === "pending"
          ? "در حال پیدا کردن موقعیت شما…"
          : place.kind === "covered"
            ? place.hood
              ? `موقعیت شما: ${place.city}، نزدیک ${place.hood}`
              : `موقعیت شما: ${place.city}`
            : place.kind === "other"
              ? `موقعیت شما: ${place.fa} · آگهی‌های ${place.fa} به‌زودی`
              : target.fa
        : phase === "fly"
          ? `در حال رفتن به ${target.fa}…`
          : `${target.fa} · ${toFaDigits(target.hoods.length)} محله · ${toFaDigits(cityCount)} آگهی`;

  return (
    <div ref={rootRef} aria-hidden className={cn("hero-map pointer-events-none fixed inset-0 overflow-hidden", className)} data-phase={phase}>
      <div className="hero-map-grid absolute inset-0" />
      <svg ref={svgRef} className="hm-lines absolute inset-0 size-full" preserveAspectRatio="none">
        <defs>
          <radialGradient id="hm-reveal">
            <stop offset="0.7" stopColor="#fff" />
            <stop offset="1" stopColor="#000" />
          </radialGradient>
          <mask id="hm-roads" maskUnits="userSpaceOnUse" x="-10000" y="-10000" width="30000" height="30000">
            <circle ref={maskRef} cx={target.box.x + target.box.w * 0.45} cy={target.box.y + target.box.h * 0.55} r="0" fill="url(#hm-reveal)" />
          </mask>
        </defs>

        <g className="hm-provinces">
          {PROVINCES.map((p, i) => (
            <path
              key={p.name}
              d={p.d}
              pathLength={1}
              className={cn("hm-province", p.name === PROVINCE_OF[target.fa] && "hm-home")}
              style={{ animationDelay: `${i * STAGGER}ms` }}
            />
          ))}
        </g>

        {arc && after("locate") && <path d={arc} className="hm-arc" pathLength={1} />}

        {roads && target.fa === "مشهد" && (
          <g className="hm-roads" mask="url(#hm-roads)">
            <path d={roads.minor} className="hm-road-minor" />
            <path d={roads.major} className="hm-road-major" />
          </g>
        )}
      </svg>

      {/* Markers: HTML so text stays crisp and pixel-sized at any zoom. */}
      <div className={cn("hm-layer hm-cities", after("fly") && "hm-hidden")}>
        {CITIES.filter((c) => c.fa !== target.fa).map((c, i) => {
          const n = stats.cities.find((x) => x.city === c.fa)?.count;
          return (
            <span key={c.en} data-x={c.x} data-y={c.y} className="hm-anchor">
              <span className="hm-city-dot" style={{ animationDelay: `${900 + i * 70}ms` }} />
              {/* other cities that already have listings */}
              {n ? <span className="hm-tag hm-tag-dim">{`${c.fa} · ${toFaDigits(n)} آگهی`}</span> : null}
            </span>
          );
        })}
      </div>

      {other && (
        <div className={cn("hm-layer", (!after("locate") || after("city")) && "hm-hidden")}>
          <span data-x={other.x} data-y={other.y} className="hm-anchor">
            <span className="hm-you" />
            <span className="hm-tag">شما · {other.fa}</span>
          </span>
        </div>
      )}

      <div className={cn("hm-layer", (!after("locate") || after("city")) && "hm-hidden")}>
        <span data-x={target.x} data-y={target.y} className="hm-anchor">
          <span className="hm-target">
            <i />
            <i />
            <i />
          </span>
          <span className="hm-tag hm-tag-strong">{target.fa}</span>
        </span>
      </div>

      <div className={cn("hm-layer", !after("city") && "hm-hidden")}>
        {target.fa === "مشهد" && (
          <span data-x={SHRINE.x} data-y={SHRINE.y} className="hm-anchor">
            <span className="hm-shrine" />
            <span className="hm-tag hm-tag-dim">حرم</span>
          </span>
        )}
        {target.hoods.map((h, i) => {
          const s = statFor(h.fa);
          const on = phase === "city" && i === active;
          return (
            <span key={h.fa} data-x={h.x} data-y={h.y} className={cn("hm-anchor hm-hood", on && "hm-on", h.fa === myHood && "hm-mine")} style={{ transitionDelay: `${i * 90}ms` }}>
              <span className="hm-pin" />
              <span className="hm-card">
                <b>{h.fa}</b>
                {h.fa === myHood && <span className="hm-near">نزدیک شما</span>}
                {s && <span className="hm-count">{toFaDigits(s.count)} آگهی</span>}
                {s && s.medianFullDeposit > 0 && (
                  <span className="hm-median">
                    میانهٔ رهن کامل <b>{formatToman(s.medianFullDeposit)}</b>
                  </span>
                )}
              </span>
            </span>
          );
        })}
      </div>

      <div className="hm-scrim absolute inset-0" />

      {/* Side panel (wide screens): the same numbers, readable even when a pin sits under the page content. */}
      <div className={cn("hm-panel", !after("city") && "hm-hidden")}>
        <div className="hm-panel-head">
          <span>محله‌های {target.fa}</span>
          <span className="hm-panel-sub">میانهٔ رهن کامل</span>
        </div>
        <ul>
          {target.hoods.map((h, i) => {
            const s = statFor(h.fa);
            return (
              <li key={h.fa} className={cn(phase === "city" && i === active && "hm-on")}>
                <span className="hm-panel-name">{h.fa}</span>
                <span className="hm-panel-count">{s ? `${toFaDigits(s.count)} آگهی` : ""}</span>
                <span className="hm-panel-price">{s?.medianFullDeposit ? formatToman(s.medianFullDeposit) : "—"}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="hm-hud">
        <span className={cn("hm-live", phase === "locate" && place.kind === "pending" && "hm-live-scan")} />
        <span key={hud} className="hm-hud-text">
          {hud}
        </span>
      </div>
    </div>
  );
}

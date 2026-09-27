"use client";

import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cityInfo } from "@/lib/places";
import { cn } from "@/lib/utils";
import type { PlaceGuess } from "@/lib/where";

import { clamp01, easeOutCubic, fitBox } from "./camera";
import { CITIES, IRAN_BOX, PROJ, PROVINCES } from "./iran-data";

// Timeline (ms from mount).
const STAGGER = 38;
const DROPS_FROM = 1800;
const DROP_EVERY = 1900;
const DROP_LIFE = 6500;
const MAX_DROPS = 4;

/**
 * Illustrative "someone just posted an ad" activity for the home-page map — a mood layer, NOT
 * listings: nothing here is searchable or claims a real ad. Titles are generic (no neighborhood or
 * price). Once real listings land, these can be swapped for the newest real titles.
 */
const ACTIVITY_TITLES = [
  "آپارتمان ۹۵ متری دوخوابه",
  "سوئیت ۴۵ متری مبله",
  "رهن کامل ۱۲۰ متری سه‌خوابه",
  "آپارتمان ۸۰ متری نوساز",
  "واحد ۷۰ متری یک‌خوابه",
  "۱۱۰ متر دوخوابه با پارکینگ",
  "رهن و اجاره ۶۵ متری",
  "ویلایی ۱۵۰ متری حیاط‌دار",
  "آپارتمان ۱۳۰ متری سه‌خوابه",
  "سوئیت ۳۸ متری نزدیک مترو",
  "دوخوابه ۹۰ متری بالکن‌دار",
  "یک‌خوابه ۶۰ متری فول امکانات",
  "رهن کامل ۷۵ متری",
  "آپارتمان ۱۰۵ متری طبقه سوم",
  "پنت‌هاوس ۱۸۰ متری",
  "دوخوابه ۸۵ متری آسانسوردار",
];

/** Bigger cities post more ads, so they get more drops (rough weights). */
const WEIGHT: Record<string, number> = { Tehran: 6, Mashhad: 3, Isfahan: 3, Karaj: 3, Shiraz: 3, Tabriz: 3, Qom: 2, Ahvaz: 2 };

interface Drop {
  id: number;
  x: number;
  y: number;
  title: string;
  city: string;
}

/** Map point (SVG user units) of a city, or null when we don't know where it is. */
function cityPoint(fa: string) {
  const c = cityInfo(fa)?.center;
  return c ? { x: (c.lng - PROJ.lon0) * PROJ.k * PROJ.cos, y: (PROJ.lat0 - c.lat) * PROJ.k } : null;
}

/** Pins for the place the query points to (one city, or every candidate when it's ambiguous). */
function focusPins(focus: PlaceGuess | undefined) {
  if (!focus || focus.status === "none") return [];
  const pins =
    focus.status === "found"
      ? [{ city: focus.city, label: focus.area ? `${focus.area}، ${focus.city}` : focus.city }]
      : focus.cities.map((c) => ({ city: c, label: `${c}؟` }));
  return pins.flatMap((p) => {
    const pt = cityPoint(p.city);
    return pt ? [{ ...p, ...pt }] : [];
  });
}

/** The intro plays once per page load; coming back from results skips the line drawing. */
let played = false;

/**
 * Live background for the home page: Iran's provinces draw themselves in gold, then place pins keep
 * dropping across the country with the title of a "new" ad. Pure SVG + a rAF camera (viewBox),
 * no map library, no location request.
 */
export function HeroMap({ className, focus }: { className?: string; focus?: PlaceGuess }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  /** Last camera, to place new drops on screen and away from the logo and the search box. */
  const view = useRef({ vx: 0, vy: 0, u: 1, vw: 0, vh: 0 });
  const [drops, setDrops] = useState<Drop[]>([]);

  // camera: fit Iran, a slow push-in, then a gentle drift
  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    if (!root || !svg) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || played) root.dataset.skip = "";
    played = true;
    let t0 = -1;
    let raf = 0;

    const frame = (now: number) => {
      if (t0 < 0) t0 = now;
      const vw = root.clientWidth || window.innerWidth;
      const vh = root.clientHeight || window.innerHeight;
      const narrow = vw < 640;
      const [cx, cy, w0] = fitBox(IRAN_BOX, vw, vh, narrow ? 0.1 : 0.14);
      const s = reduce ? 0 : (now - t0) / 1000;
      const w = w0 * (1 - 0.05 * easeOutCubic(clamp01(s / 5))) * (1 - 0.015 * Math.sin(s / 9));
      const u = w / vw;
      const h = vh * u;
      const vx = cx - w / 2 + Math.sin(s / 11) * w * 0.006;
      // phones: Iran sits lower, below the logo, the search box and the "where?" line (its north —
      // Tehran, Mashhad — is where place pins show up most)
      const vy = cy - h / 2 - (narrow ? vh * 0.2 * u : 0) + Math.sin(s / 13 + 1) * w * 0.004;
      svg.setAttribute("viewBox", `${vx} ${vy} ${w} ${h}`);
      svg.style.setProperty("--u", String(u));
      view.current = { vx, vy, u, vw, vh };

      for (const el of root.querySelectorAll<HTMLElement>("[data-x]")) {
        const x = (Number(el.dataset.x) - vx) / u;
        const y = (Number(el.dataset.y) - vy) / u;
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // activity: a new pin every ~2s somewhere in Iran
  useEffect(() => {
    let next = 0;
    let timer = 0;
    const pool = CITIES.flatMap((c) => Array<(typeof CITIES)[number]>(WEIGHT[c.en] ?? 1).fill(c));

    const spawn = () => {
      const { vx, vy, u, vw, vh } = view.current;
      const blocks = [...document.querySelectorAll("[data-hero-block]")].map((b) => b.getBoundingClientRect());
      setDrops((cur) => {
        for (let attempt = 0; attempt < 12; attempt++) {
          const c = pool[Math.floor(Math.random() * pool.length)];
          if (cur.some((d) => d.city === c.en)) continue;
          const x = c.x + (Math.random() - 0.5) * 24;
          const y = c.y + (Math.random() - 0.5) * 24;
          const sx = (x - vx) / u;
          const sy = (y - vy) / u;
          // keep the title readable: on screen, and not under the logo / search box
          if (sx < 90 || sx > vw - 90 || sy < 70 || sy > vh - 20) continue;
          if (blocks.some((r) => sx > r.left - 100 && sx < r.right + 100 && sy > r.top - 10 && sy < r.bottom + 60)) continue;
          const fresh = ACTIVITY_TITLES.filter((t) => !cur.some((d) => d.title === t));
          const title = fresh[Math.floor(Math.random() * fresh.length)];
          return [...cur.slice(-(MAX_DROPS - 1)), { id: next++, x, y, title, city: c.en }];
        }
        return cur;
      });
      timer = window.setTimeout(spawn, DROP_EVERY * (0.7 + Math.random() * 0.6));
    };
    timer = window.setTimeout(spawn, DROPS_FROM);
    return () => window.clearTimeout(timer);
  }, []);

  // retire the oldest drop when its life is over (CSS fades it out just before)
  useEffect(() => {
    if (!drops.length) return;
    const oldest = drops[0].id;
    const id = window.setTimeout(() => setDrops((cur) => cur.filter((d) => d.id !== oldest)), DROP_LIFE);
    return () => window.clearTimeout(id);
  }, [drops]);

  const pins = focusPins(focus);

  return (
    <div
      ref={rootRef}
      aria-hidden
      data-focused={pins.length ? "" : undefined}
      className={cn("hero-map pointer-events-none fixed inset-0 overflow-hidden", className)}
    >
      <div className="hero-map-grid absolute inset-0" />
      <svg ref={svgRef} className="hm-lines absolute inset-0 size-full" preserveAspectRatio="none">
        <g className="hm-provinces">
          {PROVINCES.map((p, i) => (
            <path key={p.name} d={p.d} pathLength={1} className="hm-province" style={{ animationDelay: `${i * STAGGER}ms` }} />
          ))}
        </g>
      </svg>

      {/* Markers: HTML so text stays crisp and pixel-sized at any zoom. */}
      <div className="hm-layer">
        {CITIES.map((c, i) => (
          <span key={c.en} data-x={c.x} data-y={c.y} className="hm-anchor">
            <span className="hm-city-dot" style={{ animationDelay: `${900 + i * 70}ms` }} />
          </span>
        ))}
      </div>

      <div className="hm-scrim absolute inset-0" />

      <div className="hm-layer">
        {drops.map((d) => (
          <span key={d.id} data-x={d.x} data-y={d.y} className="hm-anchor">
            <span className="hm-drop" style={{ animationDuration: `${DROP_LIFE}ms` }}>
              <span className="hm-drop-ring" />
              <MapPin className="hm-drop-pin" />
              <span className="hm-drop-title">{d.title}</span>
            </span>
          </span>
        ))}
      </div>

      {/* Where the query points to, live while typing (keyed by label so a new place pops in). */}
      <div className="hm-layer">
        {pins.map((p) => (
          <span key={p.label} data-x={p.x} data-y={p.y} className="hm-anchor">
            <span className="hm-focus">
              <span className="hm-drop-ring hm-focus-ring" />
              <MapPin className="hm-drop-pin hm-focus-pin" />
              <span className="hm-drop-title hm-focus-title">{p.label}</span>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

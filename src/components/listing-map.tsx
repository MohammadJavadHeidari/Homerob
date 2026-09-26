"use client";

import "@neshan-maps-platform/mapbox-gl/dist/NeshanMapboxGl.css";

import nmp from "@neshan-maps-platform/mapbox-gl";
import type { GeoJSONSource, Map as MapboxMap, Marker, Style } from "mapbox-gl";
import { LocateFixed, Minus, Plus, ScanSearch, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { SearchResult } from "@/lib/api-types";
import { HOOD_CENTERS, listingLatLng, type BBox } from "@/lib/geo";
import { formatToman, toFaDigits } from "@/lib/persian";
import type { Neighborhood } from "@/lib/types";
import { cn } from "@/lib/utils";

const NESHAN_KEY = process.env.NEXT_PUBLIC_NESHAN_MAP_KEY;
const MASHHAD: [number, number] = [59.535, 36.326];
const SPRING = { type: "spring", stiffness: 380, damping: 32 } as const;
/** Top N of the current order get a price label; the rest are dots until hovered. */
const LABELED = 6;

/** Keyless fallback (local dev, or if Neshan doesn't answer): standard OpenStreetMap raster tiles. */
const FALLBACK_STYLE: Style = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.35 } }],
};

type Engine = "neshan" | "fallback";

export interface ListingMapProps {
  results: SearchResult[];
  /** Hovered in the list or on the map. */
  activeId: string | null;
  selected: SearchResult | null;
  selectedWhy: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  onShowInList: (id: string) => void;
  /** Neighborhoods to outline (what the AI / filters are focused on). */
  focus: Neighborhood[];
  bbox: BBox | null;
  onBBox: (b: BBox | null) => void;
  className?: string;
}

export default function ListingMap(props: ListingMapProps) {
  const { results, activeId, selected, selectedWhy, onSelect, onShowInList, focus, bbox, onBBox, className } = props;
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLElement }>());
  const [engine, setEngine] = useState<Engine>(NESHAN_KEY ? "neshan" : "fallback");
  const [ready, setReady] = useState(false);
  const [moved, setMoved] = useState(false);
  // latest props for map event handlers
  const live = useRef(props);
  useEffect(() => {
    live.current = props;
  });

  // ---------- create the map ----------
  useEffect(() => {
    if (!box.current) return;
    const common = { container: box.current, center: MASHHAD, zoom: 12.4, minZoom: 10, maxZoom: 17.5, attributionControl: false };
    let map: MapboxMap;
    if (engine === "neshan") {
      map = new nmp.Map({
        ...common,
        mapKey: NESHAN_KEY!,
        mapType: nmp.Map.mapTypes.neshanVector,
        poi: false,
        traffic: false,
        mapTypeControllerOptions: { show: false },
      }) as unknown as MapboxMap;
    } else {
      // the SDK's Map extends mapbox-gl's Map; use the plain one with an open style
      const Base = Object.getPrototypeOf(nmp.Map) as new (o: object) => MapboxMap;
      map = new Base({ ...common, style: FALLBACK_STYLE });
    }
    map.addControl(new nmp.AttributionControl({ compact: true }), "bottom-left");
    mapRef.current = map;

    // Neshan style unreachable or key rejected → keep the demo alive on the open map
    let loaded = false;
    const giveUp = () => !loaded && engine === "neshan" && setEngine("fallback");
    const timer = setTimeout(giveUp, 8000);
    map.on("error", (e: { error?: { status?: number } }) => {
      if (e.error?.status === 401 || e.error?.status === 403) giveUp();
    });

    // "load" waits for every tile; pins only need the style, so slow tiles never hide them
    map.on("style.load", () => {
      loaded = true;
      clearTimeout(timer);
      if (map.getSource("focus")) return;
      map.addSource("focus", { type: "geojson", data: circles(live.current.focus) });
      map.addLayer({ id: "focus-fill", type: "fill", source: "focus", paint: { "fill-color": "#d73948", "fill-opacity": 0.09 } });
      map.addLayer({
        id: "focus-line",
        type: "line",
        source: "focus",
        paint: { "line-color": "#d73948", "line-width": 2, "line-dasharray": [2, 1.5], "line-opacity": 0.7 },
      });
      setReady(true);
    });
    map.on("dragstart", () => setMoved(true));
    map.on("zoomstart", (e: { originalEvent?: unknown }) => e.originalEvent && setMoved(true));
    map.on("moveend", () => {
      if (live.current.bbox) live.current.onBBox(boundsOf(map));
    });
    map.on("click", () => live.current.onSelect(null));

    // the map column animates in and the layout can change without a window resize
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(box.current);

    const markerMap = markers.current;
    return () => {
      ro.disconnect();
      clearTimeout(timer);
      markerMap.forEach(({ marker }) => marker.remove());
      markerMap.clear();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [engine]);

  // ---------- pins ----------
  const order = useMemo(() => new Map(results.map((r, i) => [r.listing.id, i])), [results]);
  const idsKey = useMemo(() => results.map((r) => r.listing.id).sort().join(","), [results]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const current = markers.current;
    const want = new Set(results.map((r) => r.listing.id));
    // leaving pins shrink out, then get removed
    for (const [id, m] of current) {
      if (want.has(id)) continue;
      current.delete(id);
      m.el.firstElementChild?.classList.add("is-leaving");
      setTimeout(() => m.marker.remove(), 220);
    }
    let fresh = 0;
    for (const r of results) {
      const id = r.listing.id;
      if (current.has(id)) continue;
      const el = pinElement(r, fresh++);
      el.addEventListener("mouseenter", () => live.current.onHover(id));
      el.addEventListener("mouseleave", () => live.current.onHover(null));
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        live.current.onSelect(id);
      });
      const { lat, lng } = listingLatLng(r.listing);
      const marker = new nmp.Marker({ element: el, anchor: "bottom" }).setLngLat([lng, lat]).addTo(map);
      current.set(id, { marker, el });
    }
  }, [results, ready]);

  // labels / active state follow the list order and hover
  useEffect(() => {
    for (const [id, { el }] of markers.current) {
      const i = order.get(id) ?? 999;
      const on = id === activeId || id === selected?.listing.id;
      paintPin(el, i < LABELED, on, on ? 1000 : 500 - Math.min(i, 499));
    }
  }, [order, activeId, selected, idsKey, ready]);

  // ---------- camera ----------
  const fitted = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || bbox || !results.length) return;
    map.resize();
    const b = new nmp.LngLatBounds();
    results.forEach((r) => {
      const { lat, lng } = listingLatLng(r.listing);
      b.extend([lng, lat]);
    });
    map.fitBounds(b, { padding: { top: 70, bottom: 60, left: 90, right: 90 }, maxZoom: 14.5, duration: fitted.current ? 900 : 0 });
    fitted.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit only when the set of pins changes
  }, [idsKey, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !selected) return;
    const { lat, lng } = listingLatLng(selected.listing);
    map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 14), duration: 700, offset: [0, -40] });
  }, [selected, ready]);

  // ---------- focus outline ----------
  useEffect(() => {
    const src = mapRef.current?.getSource("focus") as GeoJSONSource | undefined;
    if (ready && src) src.setData(circles(focus));
  }, [focus, ready]);

  const zoom = (d: number) => mapRef.current?.easeTo({ zoom: mapRef.current.getZoom() + d, duration: 300 });

  return (
    <div className={cn("bg-muted relative overflow-hidden", className)}>
      {/* mapbox-gl forces position: relative on its container, so size it from a wrapper */}
      {/* z-0: own stacking context, so marker z-indexes never climb over the overlays below */}
      <div className="absolute inset-0 z-0">
        <div ref={box} className="size-full" />
      </div>

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-background/80 text-muted-foreground flex items-center gap-2 rounded-full px-4 py-2 text-sm shadow-sm backdrop-blur">
            <span className="bg-primary size-2 animate-ping rounded-full" />
            نقشه در حال بارگذاری…
          </div>
        </div>
      )}

      {/* area search, Divar-style */}
      <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
        <AnimatePresence mode="wait">
          {bbox ? (
            <motion.button
              key="clear"
              type="button"
              initial={{ opacity: 0, y: -10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.9 }}
              transition={SPRING}
              onClick={() => {
                setMoved(false);
                onBBox(null);
              }}
              className="bg-foreground text-background pointer-events-auto flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium shadow-lg"
            >
              <X className="size-4" />
              حذف محدوده
            </motion.button>
          ) : moved && ready ? (
            <motion.button
              key="search"
              type="button"
              initial={{ opacity: 0, y: -10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.9 }}
              transition={SPRING}
              onClick={() => mapRef.current && onBBox(boundsOf(mapRef.current))}
              className="bg-background text-foreground pointer-events-auto flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold shadow-lg"
            >
              <ScanSearch className="text-primary size-4" />
              جستجو در این محدوده
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>

      {/* controls */}
      <div className="absolute top-3 left-3 flex flex-col overflow-hidden rounded-xl border bg-background shadow-md">
        <button type="button" onClick={() => zoom(1)} className="hover:bg-muted p-2" aria-label="بزرگ‌نمایی">
          <Plus className="size-4" />
        </button>
        <button type="button" onClick={() => zoom(-1)} className="hover:bg-muted border-t p-2" aria-label="کوچک‌نمایی">
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setMoved(false);
            onBBox(null);
            const map = mapRef.current;
            if (!map || !results.length) return;
            const b = new nmp.LngLatBounds();
            results.forEach((r) => {
              const { lat, lng } = listingLatLng(r.listing);
              b.extend([lng, lat]);
            });
            map.fitBounds(b, { padding: { top: 70, bottom: 60, left: 90, right: 90 }, maxZoom: 14.5, duration: 800 });
          }}
          className="hover:bg-muted border-t p-2"
          aria-label="نمایش همهٔ آگهی‌ها"
        >
          <LocateFixed className="size-4" />
        </button>
      </div>

      {engine === "fallback" && ready && (
        <span className="bg-background/80 text-muted-foreground absolute right-3 bottom-3 rounded-md px-1.5 py-0.5 text-[10px] backdrop-blur">
          نقشهٔ جایگزین
        </span>
      )}

      {/* selected listing */}
      <AnimatePresence>
        {selected && (
          <motion.div
            key={selected.listing.id}
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={SPRING}
            className="bg-card absolute inset-x-3 bottom-3 mx-auto flex max-w-md flex-col gap-2 rounded-2xl border p-3.5 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="truncate text-sm font-bold">{selected.listing.title}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {selected.listing.street ? `${selected.listing.neighborhood}، ${selected.listing.street}` : selected.listing.neighborhood}
                </p>
              </div>
              <span className="bg-primary/10 text-primary shrink-0 rounded-lg px-2 py-1 text-xs font-extrabold">
                {toFaDigits(selected.score)}٪
              </span>
              <button type="button" onClick={() => onSelect(null)} className="text-muted-foreground -m-1 p-1" aria-label="بستن">
                <X className="size-4" />
              </button>
            </div>
            <p className="text-sm">
              رهن <b>{formatToman(selected.listing.deposit)}</b>
              {selected.listing.monthlyRent > 0 ? (
                <>
                  {" "}
                  · اجاره <b>{formatToman(selected.listing.monthlyRent)}</b>
                </>
              ) : (
                " · رهن کامل"
              )}
            </p>
            {selectedWhy && <p className="bg-brand-soft line-clamp-2 rounded-lg px-2.5 py-1.5 text-xs leading-6">{selectedWhy}</p>}
            <button
              type="button"
              onClick={() => onShowInList(selected.listing.id)}
              className="text-primary self-start text-xs font-bold hover:underline"
            >
              مشاهدهٔ آگهی در لیست ←
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- helpers ----------

function boundsOf(map: MapboxMap): BBox {
  const b = map.getBounds();
  return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
}

const tone = (score: number) => (score >= 85 ? "var(--success)" : score >= 65 ? "var(--warning)" : "var(--muted-foreground)");

function paintPin(el: HTMLElement, labeled: boolean, active: boolean, z: number) {
  el.firstElementChild?.classList.toggle("is-labeled", labeled);
  el.firstElementChild?.classList.toggle("is-active", active);
  el.style.zIndex = String(z);
}

/** Marker element: mapbox-gl owns the outer node's transform, so the animation lives on the inner one. */
function pinElement(r: SearchResult, i: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "hr-pin-anchor";
  const pin = document.createElement("button");
  pin.type = "button";
  pin.className = "hr-pin";
  pin.style.setProperty("--pin", tone(r.score));
  pin.style.setProperty("--d", `${Math.min(i, 30) * 18}ms`);
  pin.setAttribute("aria-label", `${r.listing.title}، ${formatToman(r.fullDeposit)}`);
  const body = document.createElement("span");
  body.className = "hr-pin__body";
  const dot = document.createElement("span");
  dot.className = "hr-pin__dot";
  const label = document.createElement("span");
  label.className = "hr-pin__label";
  label.textContent = formatToman(Math.round(r.fullDeposit / 1e7) * 1e7); // ۸۳۰ میلیون, not ۸۳۳٫۳
  body.append(dot, label);
  pin.append(body);
  el.append(pin);
  return el;
}

/** ~1.2 km circles around neighborhood centers, as GeoJSON polygons. */
function circles(hoods: Neighborhood[]) {
  return {
    type: "FeatureCollection" as const,
    features: hoods.map((h) => {
      const c = HOOD_CENTERS[h];
      const ring = Array.from({ length: 65 }, (_, i) => {
        const a = (i / 64) * 2 * Math.PI;
        return [c.lng + (0.0115 * Math.cos(a)) / Math.cos((c.lat * Math.PI) / 180), c.lat + 0.0115 * Math.sin(a)];
      });
      return { type: "Feature" as const, properties: { name: h }, geometry: { type: "Polygon" as const, coordinates: [ring] } };
    }),
  };
}

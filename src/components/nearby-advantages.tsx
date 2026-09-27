"use client";

import {
  BusFront,
  Croissant,
  Dumbbell,
  Hospital,
  type LucideIcon,
  Mosque,
  Pill,
  School,
  ShoppingBasket,
  Sparkles,
  Stethoscope,
  TrainFront,
  Trees,
} from "lucide-react";
import { useEffect, useState } from "react";

import type { NearbyApiResponse } from "@/lib/api-types";
import type { PoiCat } from "@/lib/nearby/facts";
import { cn } from "@/lib/utils";

export const NEARBY_ICON: Record<PoiCat, { icon: LucideIcon; color: string }> = {
  rail: { icon: TrainFront, color: "#2563eb" },
  bus: { icon: BusFront, color: "#0891b2" },
  supermarket: { icon: ShoppingBasket, color: "#d97706" },
  bakery: { icon: Croissant, color: "#b45309" },
  pharmacy: { icon: Pill, color: "#16a34a" },
  clinic: { icon: Stethoscope, color: "#dc2626" },
  hospital: { icon: Hospital, color: "#dc2626" },
  gym: { icon: Dumbbell, color: "#7c3aed" },
  park: { icon: Trees, color: "#15803d" },
  mosque: { icon: Mosque, color: "#0d9488" },
  school: { icon: School, color: "#9333ea" },
};

const sourcesFa = (items: NearbyApiResponse["items"]) =>
  [...new Set(items.map((i) => i.source))].map((s) => (s === "neshan" ? "نقشهٔ نشان" : "OpenStreetMap")).join("، ");

// one request per listing, shared by the card and the map
const cache = new Map<string, NearbyApiResponse | null>();
const inFlight = new Map<string, Promise<NearbyApiResponse | null>>();

function load(id: string): Promise<NearbyApiResponse | null> {
  let p = inFlight.get(id);
  if (!p) {
    p = fetch(`/api/nearby?id=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? (r.json() as Promise<NearbyApiResponse>) : null))
      .catch(() => null)
      .then((d) => {
        if (d) cache.set(id, d); // failures aren't cached, the next open retries
        inFlight.delete(id);
        return d;
      });
    inFlight.set(id, p);
  }
  return p;
}

/** Neighborhood advantages of a listing; `id = null` loads nothing. */
export function useNearby(id: string | null) {
  const [state, setState] = useState<{ id: string; data: NearbyApiResponse | null } | null>(null);
  useEffect(() => {
    if (!id || cache.has(id)) return;
    let live = true;
    load(id).then((data) => live && setState({ id, data }));
    return () => {
      live = false;
    };
  }, [id]);
  if (!id) return { data: null, loading: false };
  const data = cache.get(id) ?? (state?.id === id ? state.data : null);
  return { data, loading: !data && !(state?.id === id) };
}

/**
 * «مزیت‌های محله»: only the good things around a home — real places from OpenStreetMap within
 * walking distance, written up by the AI (grounded: names and minutes come from the data).
 */
export function NearbyAdvantages({
  id,
  compact,
  onHoverItem,
}: {
  id: string;
  compact?: boolean;
  onHoverItem?: (key: PoiCat | null) => void;
}) {
  const { data, loading } = useNearby(id);

  if (loading) {
    return (
      <div className="flex flex-col gap-2" aria-busy>
        <p className="text-primary flex items-center gap-1.5 text-xs font-bold">
          <Sparkles className="size-3.5 animate-pulse" />
          ترب داره محله رو برات می‌گرده…
        </p>
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-muted h-7 animate-pulse rounded-lg" style={{ width: `${88 - i * 14}%` }} />
        ))}
      </div>
    );
  }
  if (!data?.items.length) {
    return <p className="text-muted-foreground text-xs">هنوز اطلاعات کافی از اطراف این خونه نداریم.</p>;
  }

  const items = compact ? data.items.slice(0, 4) : data.items;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1">
        <p className="text-primary flex items-center gap-1.5 text-[11px] font-bold">
          <Sparkles className="size-3.5" />
          مزیت‌های محله
          {data.source === "ai" && <span className="bg-primary/15 ms-auto rounded px-1.5 py-px text-[10px] font-bold">AI</span>}
        </p>
        <p className={cn("leading-7 font-extrabold", compact ? "text-sm" : "text-base")}>{data.title}</p>
        {data.summary && !compact && <p className="text-muted-foreground text-sm leading-6">{data.summary}</p>}
      </div>
      <ul className={cn("grid gap-1.5", !compact && "sm:grid-cols-2")}>
        {items.map((i) => {
          const { icon: Icon, color } = NEARBY_ICON[i.key];
          return (
            <li
              key={i.key}
              onMouseEnter={() => onHoverItem?.(i.key)}
              onMouseLeave={() => onHoverItem?.(null)}
              className="bg-background/70 flex items-start gap-2 rounded-lg border px-2 py-1.5 text-xs leading-5"
            >
              <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-md text-white" style={{ background: color }}>
                <Icon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">{i.text}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-muted-foreground text-[10px]">
        مکان‌ها واقعی‌اند ({sourcesFa(data.items)})؛ زمان‌ها پیاده و تقریبی.
      </p>
    </div>
  );
}

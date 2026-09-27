"use client";

import { MapPin, MapPinned } from "lucide-react";
import { useSyncExternalStore } from "react";

import type { PlaceGuess, SearchApiResponse } from "@/lib/api-types";
import { isCovered } from "@/lib/places";
import { cn } from "@/lib/utils";

/** Big rental markets first; the city of the user's last search jumps to the front. */
const QUICK_CITIES = ["تهران", "مشهد", "اصفهان", "شیراز", "کرج"];
const LAST_CITY_KEY = "homerob:last-city";

export function rememberCity(city: string | null) {
  if (!city) return;
  try {
    localStorage.setItem(LAST_CITY_KEY, city);
  } catch {
    // private mode / blocked storage: the chips just keep their default order
  }
}

export function readLastCity() {
  try {
    return localStorage.getItem(LAST_CITY_KEY);
  } catch {
    return null;
  }
}

const noop = () => () => {};

function useQuickCities() {
  const last = useSyncExternalStore(noop, readLastCity, () => null);
  return last ? [last, ...QUICK_CITIES.filter((c) => c !== last)].slice(0, 5) : QUICK_CITIES;
}

/** The query with a city written into it, so the text stays the one source of truth. */
export function withCity(query: string, city: string) {
  return `${query.trim().replace(/[،,.؟?]+$/, "")} در ${city}`;
}

function CityChip({ city, onClick, label }: { city: string; onClick: (c: string) => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => onClick(city)}
      className="border-border bg-card/60 hover:border-foreground/40 hover:bg-secondary hover:text-foreground inline-flex h-7 items-center rounded-full border px-3 text-[13px] font-medium transition-colors"
    >
      {label ?? city}
    </button>
  );
}

/**
 * Live "where?" line under the search box: shows the place the query points to while the user types,
 * asks "which city?" when a name exists in several, and offers one-tap cities when there's none.
 */
export function PlaceLine({
  query,
  guess,
  onAddCity,
  className,
}: {
  query: string;
  guess: PlaceGuess;
  onAddCity: (city: string) => void;
  className?: string;
}) {
  const quick = useQuickCities();
  if (query.trim().length < 3) return null;

  return (
    <div aria-live="polite" data-hero-block className={cn("text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm", className)}>
      {guess.status === "found" ? (
        <>
          <MapPin className="text-primary size-4 shrink-0" />
          <span>
            جستجو در{" "}
            <b className="text-foreground font-semibold">
              {guess.area ? `${guess.area}، ` : ""}
              {guess.city}
            </b>
          </span>
          {!isCovered(guess.city) && <span className="text-xs opacity-80">· هنوز آگهی‌ای از {guess.city} نداریم</span>}
        </>
      ) : guess.status === "ambiguous" ? (
        <>
          <MapPinned className="text-primary size-4 shrink-0" />
          <span>«{guess.area}» کدوم شهر؟</span>
          {guess.cities.map((c) => (
            <CityChip key={c} city={c} onClick={onAddCity} />
          ))}
        </>
      ) : (
        <>
          <MapPin className="size-4 shrink-0" />
          <span>کجا؟</span>
          {quick.map((c) => (
            <CityChip key={c} city={c} onClick={onAddCity} />
          ))}
          <span className="hidden text-xs opacity-70 sm:inline">یا اسم شهر یا محله رو بنویس</span>
        </>
      )}
    </div>
  );
}

/**
 * On the results page: say which city the results are from when the query was unclear, and let the
 * user switch in one tap (the city is written into the query and searched again).
 */
export function PlaceQuestion({ data, onAddCity }: { data: SearchApiResponse; onAddCity: (city: string) => void }) {
  const quick = useQuickCities();
  const { where, intent } = data;
  if (where.status === "ambiguous") {
    const others = where.cities.filter((c) => c !== intent.city);
    return (
      <Question icon={MapPinned}>
        <span>
          «{where.area}» تو {where.cities.join(" و ")} هست{intent.city ? `؛ نتایج از ${intent.city} است` : ""}. منظورت اینه؟
        </span>
        {others.map((c) => (
          <CityChip key={c} city={c} onClick={onAddCity} label={`${where.area} ${c}`} />
        ))}
      </Question>
    );
  }
  if (where.status === "none" && !intent.city) {
    return (
      <Question icon={MapPin}>
        <span>شهر رو نگفتی، برای همین همهٔ ایران رو گشتم. کجا دنبال خونه‌ای؟</span>
        {quick.map((c) => (
          <CityChip key={c} city={c} onClick={onAddCity} />
        ))}
      </Question>
    );
  }
  return null;
}

function Question({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground flex items-start gap-2 text-sm">
      <Icon className="text-primary mt-1 size-4 shrink-0" />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 leading-7">{children}</div>
    </div>
  );
}

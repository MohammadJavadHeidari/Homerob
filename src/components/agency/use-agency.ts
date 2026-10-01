"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useOwnAds } from "@/lib/account/ads-store";
import { useAdEvents } from "@/lib/account/events-store";
import { useSession } from "@/lib/account/session";
import { overview, type MarketRef } from "@/lib/account/stats";
import { categoryOf } from "@/lib/categories";
import type { Listing } from "@/lib/types";

/** The signed-in agency's files and their stats (the shell guarantees a session). */
export function useAgency() {
  const session = useSession("agency");
  const ads = useOwnAds("agency", session?.phone);
  const events = useAdEvents();
  const stats = useMemo(() => overview(events, ads.map((a) => a.id)), [events, ads]);
  return { session, ads, stats };
}

let marketCache: Record<string, MarketRef> | null = null;

/** Real-ad medians per category/city/neighborhood (/api/market), fetched once per page load. */
export function useMarket() {
  const [byKey, setByKey] = useState(marketCache);
  useEffect(() => {
    if (marketCache) return;
    fetch("/api/market")
      .then((r) => r.json() as Promise<{ byKey: Record<string, MarketRef> }>)
      .then((j) => {
        marketCache = j.byKey;
        setByKey(j.byKey);
      })
      .catch(() => {});
  }, []);
  return useCallback(
    (l: Pick<Listing, "category" | "city" | "neighborhood">): MarketRef | null => byKey?.[`${categoryOf(l)}/${l.city}/${l.neighborhood}`] ?? null,
    [byKey],
  );
}

"use client";

import type { AdEvent, AdEventType } from "./stats";
import { createLocalStore } from "./local-store";

/**
 * What visitors did with ads on this device: shown in a list (impression), opened (view), tapped «اطلاعات
 * تماس» (contact), saved (♥). Real events only, never generated. The agency dashboard reads these.
 */
const MAX_EVENTS = 5000;
const store = createLocalStore<AdEvent[]>("homerob:events:v1", [], (raw) => (Array.isArray(raw) ? (raw as AdEvent[]) : []));

export const useAdEvents = store.use;

// an ad shown in a list counts once per page load, not on every re-render
const seenThisLoad = new Set<string>();

export function track(id: string, type: AdEventType) {
  if (type === "impression") {
    if (seenThisLoad.has(id)) return;
    seenThisLoad.add(id);
  }
  store.update((events) => [...events.slice(-(MAX_EVENTS - 1)), { id, type, at: Date.now() }]);
}

export function trackImpressions(ids: string[]) {
  const fresh = ids.filter((id) => !seenThisLoad.has(id));
  if (!fresh.length) return;
  fresh.forEach((id) => seenThisLoad.add(id));
  const at = Date.now();
  store.update((events) => [...events, ...fresh.map((id) => ({ id, type: "impression" as const, at }))].slice(-MAX_EVENTS));
}

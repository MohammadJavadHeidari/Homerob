"use client";

import { useCallback, useEffect, useState } from "react";

import { locate, type UserPlace } from "@/lib/geo";

export type PlaceStatus = "idle" | "locating" | "found" | "unavailable";

const STORAGE_KEY = "homerob:place";

/** Last known place, so a reload shows the user's city instantly. */
export function readStoredPlace(): UserPlace | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserPlace) : null;
  } catch {
    return null;
  }
}

function storePlace(place: UserPlace) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(place));
  } catch {
    // private mode / blocked storage: fine, we just ask again next time
  }
}

/** Ask for the browser location on first visit and turn it into a city + nearest neighborhood. */
export function useUserPlace() {
  const [status, setStatus] = useState<PlaceStatus>("idle");
  const [place, setPlace] = useState<UserPlace | null>(null);

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus((s) => (s === "found" ? s : "unavailable"));
      return;
    }
    setStatus((s) => (s === "found" ? s : "locating"));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const next = locate({ lat: coords.latitude, lng: coords.longitude });
        setPlace(next);
        setStatus("found");
        storePlace(next);
      },
      () => setStatus((s) => (s === "found" ? s : "unavailable")),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  }, []);

  useEffect(() => {
    const stored = readStoredPlace();
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the last place once on mount
      setPlace(stored);
      setStatus("found");
    }
    request();
  }, [request]);

  return { status, place, request };
}

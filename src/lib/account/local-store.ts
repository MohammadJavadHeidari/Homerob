"use client";

import { useSyncExternalStore } from "react";

/**
 * A tiny localStorage-backed store (same pattern as src/lib/taste-store.ts). The account prototype has no
 * server database (DECISIONS: flat files, no DB), so sessions, posted ads and view events live on this device.
 * Other tabs stay in sync through the `storage` event.
 */
export function createLocalStore<T>(key: string, empty: T, revive: (raw: unknown) => T = (raw) => raw as T) {
  let cache: { raw: string | null; state: T } = { raw: null, state: empty };
  const listeners = new Set<() => void>();

  function read(): T {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      // blocked storage: behave like a first visit
    }
    if (raw === cache.raw) return cache.state;
    let state = empty;
    try {
      state = raw ? revive(JSON.parse(raw)) : empty;
    } catch {
      state = empty;
    }
    cache = { raw, state };
    return state;
  }

  function write(next: T) {
    const raw = JSON.stringify(next);
    try {
      localStorage.setItem(key, raw);
    } catch {
      // quota / blocked: keep it for this page view at least
    }
    cache = { raw, state: next };
    listeners.forEach((l) => l());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => e.key === key && listener();
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  const use = () => useSyncExternalStore(subscribe, read, () => empty);
  const update = (fn: (s: T) => T) => write(fn(read()));

  return { read, write, update, use };
}

/** True after hydration (localStorage-backed state is only known on the client). */
export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

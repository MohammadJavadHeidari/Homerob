"use client";

import { useSyncExternalStore } from "react";

import type { LastSearch } from "@/lib/feed";

/**
 * What the visitor did on this phone: saved listings (♥), opened listings, recent searches.
 * Lives only in localStorage (no account); the mobile home rails are built from it.
 */
export interface TasteState {
  /** Newest first. */
  saved: string[];
  /** Newest first. */
  viewed: string[];
  /** Newest first, distinct queries. */
  searches: LastSearch[];
}

const KEY = "homerob:taste:v1";
const EMPTY: TasteState = { saved: [], viewed: [], searches: [] };
const LIMITS = { saved: 50, viewed: 30, searches: 5 } as const;

let cache: { raw: string | null; state: TasteState } = { raw: null, state: EMPTY };
const listeners = new Set<() => void>();

function read(): TasteState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // blocked storage: behave like a first visit
  }
  if (raw === cache.raw) return cache.state;
  let state = EMPTY;
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<TasteState>) : {};
    state = { saved: parsed.saved ?? [], viewed: parsed.viewed ?? [], searches: parsed.searches ?? [] };
  } catch {
    state = EMPTY;
  }
  cache = { raw, state };
  return state;
}

function write(next: TasteState) {
  const raw = JSON.stringify(next);
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    // keep it for this page view at least
  }
  cache = { raw, state: next };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useTaste(): TasteState {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

const front = <T,>(xs: T[], x: T, limit: number, same: (a: T) => boolean) => [x, ...xs.filter((y) => !same(y))].slice(0, limit);

export function toggleSave(id: string) {
  const s = read();
  write({ ...s, saved: s.saved.includes(id) ? s.saved.filter((x) => x !== id) : front(s.saved, id, LIMITS.saved, (x) => x === id) });
}

export function markViewed(id: string) {
  const s = read();
  if (s.viewed[0] === id) return;
  write({ ...s, viewed: front(s.viewed, id, LIMITS.viewed, (x) => x === id) });
}

export function rememberSearch(entry: LastSearch) {
  const s = read();
  write({ ...s, searches: front(s.searches, entry, LIMITS.searches, (x) => x.query === entry.query) });
}

export function clearTaste() {
  write(EMPTY);
}

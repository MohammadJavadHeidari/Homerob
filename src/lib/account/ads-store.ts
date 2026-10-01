"use client";

import { useMemo } from "react";

import type { PostedAd } from "./ads";
import { createLocalStore } from "./local-store";
import type { Role } from "./session";

/** Ads posted on this device, newest first. */
const store = createLocalStore<PostedAd[]>("homerob:ads:v1", [], (raw) => (Array.isArray(raw) ? (raw as PostedAd[]) : []));

export const usePostedAds = store.use;
export const readPostedAds = store.read;

/** Ads a signed-in account owns (by role + phone). */
export function useOwnAds(role: Role, phone: string | undefined) {
  const all = store.use();
  return useMemo(() => (phone ? all.filter((a) => a.owner === role && a.ownerPhone === phone) : []), [all, role, phone]);
}

/** Published ads anyone browsing on this device can see. */
export function usePublishedAds() {
  const all = store.use();
  return useMemo(() => all.filter((a) => a.status === "published"), [all]);
}

export function addAds(ads: PostedAd[]) {
  store.update((all) => [...ads, ...all]);
}

export function updateAd(ad: PostedAd) {
  store.update((all) => all.map((a) => (a.id === ad.id ? ad : a)));
}

export function setAdStatus(id: string, status: PostedAd["status"]) {
  store.update((all) => all.map((a) => (a.id === id ? { ...a, status } : a)));
}

export function deleteAd(id: string) {
  store.update((all) => all.filter((a) => a.id !== id));
}

import type { Metadata } from "next";

import { AdsBrowser } from "@/components/account/ads-browser";
import { SiteHeader } from "@/components/account/site-header";
import { listings } from "@/data/listings";

export const metadata: Metadata = { title: "آگهی‌های املاک | ترب" };

/** Divar-style feed of every ad, newest first: the real ads plus the ones posted on Torob from this device. */
export default function AdsPage() {
  const real = [...listings].sort((a, b) => b.postedAt.localeCompare(a.postedAt));
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6">
        <AdsBrowser real={real} />
      </main>
    </>
  );
}

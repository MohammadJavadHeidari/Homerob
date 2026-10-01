import type { Metadata } from "next";

import { NewAd } from "@/components/account/new-ad";
import { SiteHeader } from "@/components/account/site-header";

export const metadata: Metadata = { title: "ثبت آگهی ملک | ترب" };

export default function NewAdPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
        <NewAd />
      </main>
    </>
  );
}

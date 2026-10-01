import type { Metadata } from "next";

import { MyPanel } from "@/components/account/my-panel";
import { SiteHeader } from "@/components/account/site-header";

export const metadata: Metadata = { title: "ترب من | ترب" };

export default function MyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6">
        <MyPanel />
      </main>
    </>
  );
}

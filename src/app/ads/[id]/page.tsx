import type { Metadata } from "next";

import { AdDetail } from "@/components/account/ad-detail";
import { SiteHeader } from "@/components/account/site-header";
import { listings } from "@/data/listings";

export async function generateMetadata({ params }: PageProps<"/ads/[id]">): Promise<Metadata> {
  const { id } = await params;
  const l = listings.find((x) => x.id === id);
  return { title: l ? `${l.title} | ترب` : "آگهی | ترب" };
}

/** One ad. Real ads render from the server data; ads posted on this device are read from it on the client. */
export default async function AdPage({ params }: PageProps<"/ads/[id]">) {
  const { id } = await params;
  const real = listings.find((x) => x.id === id) ?? null;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6">
        <AdDetail id={id} real={real} />
      </main>
    </>
  );
}

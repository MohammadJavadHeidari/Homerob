"use client";

import { ArrowRight, BarChart3, Building2, Check, ChevronLeft, ChevronRight, ImageOff, MapPin, Phone, Share2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { ListingPhoto } from "@/components/listing-photo";
import { NearbyAdvantages } from "@/components/nearby-advantages";
import { Button } from "@/components/ui/button";
import { isPostedId, type PostedAd } from "@/lib/account/ads";
import { usePostedAds } from "@/lib/account/ads-store";
import { track, useAdEvents } from "@/lib/account/events-store";
import { useHydrated } from "@/lib/account/local-store";
import { formatMobile, useSessions } from "@/lib/account/session";
import { CATEGORIES, categoryOf } from "@/lib/categories";
import { ageFa, floorFa, roomsFa, timeAgoFa } from "@/lib/format";
import { formatToman, toFaDigits } from "@/lib/persian";
import { photoSources } from "@/lib/photo";
import { toggleSave, markViewed, useTaste } from "@/lib/taste-store";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

/** One ad, Divar's detail layout: photos, title + time/place, price, specs, features, description, contact. */
export function AdDetail({ id, real }: { id: string; real: Listing | null }) {
  const hydrated = useHydrated();
  const posted = usePostedAds();
  const ad: PostedAd | undefined = posted.find((a) => a.id === id);
  const listing: Listing | null = real ?? ad ?? null;

  // one view per open (not per re-render); also feeds the phone home's «اخیراً دیدی»
  const counted = useRef(false);
  useEffect(() => {
    if (!listing || counted.current) return;
    counted.current = true;
    if (isPostedId(listing.id)) track(listing.id, "view");
    markViewed(listing.id);
  }, [listing]);

  if (!listing) {
    if (!hydrated) return <div className="bg-muted h-96 animate-pulse rounded-2xl" />;
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
        <h1 className="text-lg font-bold">این آگهی پیدا نشد</h1>
        <p className="text-muted-foreground text-sm">شاید حذف شده باشه، یا روی یه دستگاه دیگه ثبت شده باشه.</p>
        <Link href="/ads" className="text-primary text-sm font-medium">
          برگشت به آگهی‌ها
        </Link>
      </div>
    );
  }
  return <Detail listing={listing} ad={ad} />;
}

function Detail({ listing: l, ad }: { listing: Listing; ad?: PostedAd }) {
  const sessions = useSessions();
  const events = useAdEvents();
  const saved = useTaste().saved.includes(l.id);
  const [contactOpen, setContactOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const info = CATEGORIES[categoryOf(l)];
  const mine = ad && sessions[ad.owner]?.phone === ad.ownerPhone;
  const views = useMemo(() => (mine ? events.filter((e) => e.id === l.id && e.type === "view").length : 0), [mine, events, l.id]);
  // photos posted on Torob; a real ad has one photo with fallbacks (our copy, then Divar's CDN)
  const sources = photoSources(l);
  const photos = ad ? ad.images.map((src) => [src]) : sources.length ? [sources] : [];

  const specs: [string, string][] = [
    ["متراژ", `${toFaDigits(l.areaM2)} متر`],
    ...(info.residential ? [["اتاق", roomsFa(l.rooms).replace("خواب: ", "")] as [string, string]] : []),
    ["طبقه", floorFa(l.floor, l.totalFloors).replace("طبقه: ", "")],
    ["ساخت", ageFa(l.buildingAge).replace("سن بنا: ", "")],
  ];
  const features = [
    l.elevator && "آسانسور",
    l.parking && "پارکینگ",
    l.storage && "انباری",
    ...l.tags,
    l.convertible && "قابل تبدیل",
  ].filter((x): x is string => Boolean(x));

  return (
    <div className="flex flex-col gap-5">
      <Link href="/ads" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm">
        <ArrowRight className="size-4" />
        همهٔ آگهی‌ها
      </Link>

      {mine && (
        <div className="bg-card flex flex-wrap items-center gap-3 rounded-lg p-3 text-sm">
          <BarChart3 className="text-primary size-5" />
          <span className="flex-1">
            این آگهی شماست. تا حالا <b>{toFaDigits(views)}</b> بار دیده شده.
          </span>
          <Link href={ad!.owner === "agency" ? "/agency" : "/my"} className="text-primary font-medium">
            {ad!.owner === "agency" ? "داشبورد املاک" : "آگهی‌های من"}
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        {/* photos (end side on desktop, like Divar) */}
        <Gallery photos={photos} className="lg:order-2" />

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="text-xl leading-9 font-bold">{l.title}</h1>
            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <MapPin className="size-4" />
              {timeAgoFa(l.postedAt)} در {l.neighborhood}، {l.city}
              {l.street && <span className="opacity-70">({l.street})</span>}
            </p>
            {ad && (
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                {ad.owner === "agency" ? <Building2 className="size-3.5" /> : null}
                {ad.owner === "agency" ? `آگهی ${ad.ownerName || "املاک"}` : "آگهی شخصی"} · ثبت‌شده در ترب
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              size="lg"
              className="h-11 flex-1 text-sm font-bold"
              onClick={() => {
                if (!contactOpen && isPostedId(l.id)) track(l.id, "contact");
                setContactOpen(true);
              }}
            >
              <Phone />
              اطلاعات تماس
            </Button>
            <Button
              size="lg"
              variant="outline"
              className={cn("h-11 px-4", saved && "text-primary")}
              aria-pressed={saved}
              onClick={() => {
                if (!saved && isPostedId(l.id)) track(l.id, "save");
                toggleSave(l.id);
              }}
            >
              {saved ? <Check /> : null}
              {saved ? "نشان شد" : "نشان کردن"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 px-3"
              aria-label="کپی لینک"
              onClick={() => {
                void navigator.clipboard?.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check /> : <Share2 />}
            </Button>
          </div>
          {contactOpen && (
            <div className="bg-card flex flex-col gap-1 rounded-lg p-4 text-sm">
              {ad ? (
                <>
                  <span className="text-muted-foreground text-xs">{ad.owner === "agency" ? ad.ownerName : "آگهی‌دهنده"}</span>
                  <a href={`tel:${ad.ownerPhone}`} dir="ltr" className="text-end text-lg font-bold tracking-wide">
                    {formatMobile(ad.ownerPhone)}
                  </a>
                  <span className="text-muted-foreground text-xs">زنگ بزن یا پیام بده؛ بگو آگهی رو در ترب دیدی.</span>
                </>
              ) : (
                <span className="text-muted-foreground leading-6">
                  ترب شمارهٔ آگهی‌دهنده‌های بیرونی رو نگه نمی‌داره. در نسخهٔ کامل، تماس از همین‌جا به آگهی‌دهنده وصل می‌شه.
                </span>
              )}
            </div>
          )}

          <dl className="bg-card grid grid-cols-2 gap-px overflow-hidden rounded-lg sm:grid-cols-4">
            {specs.map(([k, v]) => (
              <div key={k} className="flex flex-col gap-1 p-3 text-center">
                <dt className="text-muted-foreground text-xs">{k}</dt>
                <dd className="text-sm font-bold">{v}</dd>
              </div>
            ))}
          </dl>

          <PriceBlock l={l} />

          {features.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-bold">امکانات</h2>
              <div className="flex flex-wrap gap-2">
                {features.map((f) => (
                  <span key={f} className="bg-secondary border-input rounded-full border px-3 py-1 text-xs">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {l.description && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-bold">توضیحات</h2>
              <p className="text-sm leading-8 whitespace-pre-line">{l.description}</p>
            </div>
          )}

          {/* real places around it (OSM / Neshan) for ads in our data; device-posted ads aren't on the server */}
          {!ad && (
            <div className="bg-card flex flex-col gap-3 rounded-lg p-4">
              <h2 className="flex items-center gap-1.5 text-sm font-bold">
                <Sparkles className="text-primary size-4" />
                اطراف این خونه چی داره؟
              </h2>
              <NearbyAdvantages id={l.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PriceBlock({ l }: { l: Listing }) {
  const model = CATEGORIES[categoryOf(l)].priceModel;
  const rows: [string, string][] =
    model === "sale"
      ? [
          ["قیمت کل", `${formatToman(l.price ?? 0)} تومان`],
          ["قیمت هر متر", `${formatToman(Math.round((l.price ?? 0) / Math.max(1, l.areaM2)))} تومان`],
        ]
      : model === "nightly"
        ? [["هر شب", `${formatToman(l.nightlyPrice ?? 0)} تومان`]]
        : l.monthlyRent > 0
          ? [
              ["رهن", `${formatToman(l.deposit)} تومان`],
              ["اجارهٔ ماهانه", `${formatToman(l.monthlyRent)} تومان`],
            ]
          : [["رهن کامل", `${formatToman(l.deposit)} تومان`]];
  return (
    <dl className="bg-card flex flex-col rounded-lg px-4">
      {rows.map(([k, v], i) => (
        <div key={k} className={cn("flex items-center justify-between py-3 text-sm", i > 0 && "border-t")}>
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="font-bold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** `photos[i]` = one photo's sources, best first. */
function Gallery({ photos, className }: { photos: string[][]; className?: string }) {
  const [i, setI] = useState(0);
  const empty = (
    <div className={cn("bg-muted text-muted-foreground grid aspect-[4/3] place-items-center rounded-2xl sm:rounded-lg", className)}>
      <span className="flex flex-col items-center gap-2 text-sm">
        <ImageOff className="size-8 opacity-50" />
        این آگهی عکس نداره
      </span>
    </div>
  );
  if (!photos.length) return empty;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="bg-muted text-muted-foreground relative grid aspect-[4/3] place-items-center overflow-hidden rounded-2xl sm:rounded-lg">
        <ImageOff className="size-8 opacity-50" />
        <ListingPhoto sources={photos[i]} className="absolute inset-0 size-full object-cover" />
        {photos.length > 1 && (
          <>
            <button
              type="button"
              aria-label="عکس قبلی"
              onClick={() => setI((i - 1 + photos.length) % photos.length)}
              className="bg-card/90 absolute start-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full shadow-xs"
            >
              <ChevronRight className="size-4" />
            </button>
            <button
              type="button"
              aria-label="عکس بعدی"
              onClick={() => setI((i + 1) % photos.length)}
              className="bg-card/90 absolute end-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full shadow-xs"
            >
              <ChevronLeft className="size-4" />
            </button>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2">
          {photos.map((sources, j) => (
            <button
              key={j}
              type="button"
              onClick={() => setI(j)}
              aria-label={`عکس ${toFaDigits(j + 1)}`}
              className={cn("size-16 overflow-hidden rounded-md ring-2 ring-transparent", j === i && "ring-foreground")}
            >
              <ListingPhoto sources={sources} className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

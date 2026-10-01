"use client";

import { ChevronLeft, Heart, History, House, Sparkles } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { ListingCard } from "@/components/listing-card";
import { ListingPhoto } from "@/components/listing-photo";
import { PhotoPlaceholder } from "@/components/photo-placeholder";
import { readLastCity } from "@/components/place-hint";
import { SaveButton } from "@/components/save-button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { SearchIntent, SearchResult } from "@/lib/api-types";
import { CATEGORIES, categoryOf } from "@/lib/categories";
import { HERO_EXAMPLES } from "@/lib/demo-queries";
import type { Feed, Rail, RailItem, Signal } from "@/lib/feed";
import { roomsFa } from "@/lib/format";
import { formatToman, toFaDigits } from "@/lib/persian";
import { photoSources } from "@/lib/photo";
import type { SortKey } from "@/lib/search/refine";
import { clearTaste, markViewed, useTaste } from "@/lib/taste-store";
import { cn } from "@/lib/utils";

type RunFn = (query: string, intent?: SearchIntent, sort?: SortKey) => void;

const PHONE = "(max-width: 639px)";
function subscribeWidth(cb: () => void) {
  const m = window.matchMedia(PHONE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
/** The feed is a phone thing; desktop keeps the logo + search home (DECISIONS 2026-09-27). */
export function useIsPhone() {
  return useSyncExternalStore(subscribeWidth, () => window.matchMedia(PHONE).matches, () => false);
}

type Panel = { kind: "detail"; item: SearchResult } | { kind: "saved" } | null;

/**
 * Mobile home under the search box, Torob-style: recent-search chips, an assistant banner and
 * horizontal rails (docs/research/mobile-home.md). Rails come from /api/feed and the history
 * this phone keeps in localStorage (src/lib/taste-store.ts).
 */
export function HomeFeed({ onRun, onAsk }: { onRun: RunFn; onAsk: () => void }) {
  const taste = useTaste();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [failed, setFailed] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const last = taste.searches[0] ?? null;
  const request = JSON.stringify({ saved: taste.saved, viewed: taste.viewed, last });

  useEffect(() => {
    const ctrl = new AbortController();
    const body = { city: readLastCity(), ...JSON.parse(request) };
    fetch("/api/feed", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<Feed>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((f) => {
        setFeed(f);
        setFailed(false);
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setFailed(true);
      });
    return () => ctrl.abort();
  }, [request]);

  const open = (item: SearchResult) => {
    markViewed(item.listing.id);
    setPanel({ kind: "detail", item });
  };

  return (
    <>
      <section
        aria-label="پیشنهادها"
        className="bg-background text-foreground relative z-10 -mt-6 flex flex-col gap-1 rounded-t-3xl pt-2 pb-28 shadow-[0_-12px_32px_-16px_rgb(0_0_0/0.5)]"
      >
        <div className="bg-border mx-auto h-1 w-9 rounded-full" aria-hidden />

        {/* Torob's trending-chips row → your recent searches (first visit: three short examples) */}
        <div className="flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pt-3 pb-1">
          {taste.searches.length
            ? taste.searches.map((s) => (
                <button
                  key={s.query}
                  type="button"
                  onClick={() => onRun(s.query, s.intent)}
                  className="bg-brand-soft text-brand-ink border-primary/20 inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-[13px] font-medium"
                >
                  <History className="size-3.5" />
                  {s.query}
                </button>
              ))
            : HERO_EXAMPLES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onRun(q)}
                  className="bg-card inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-[13px] font-medium"
                >
                  {q}
                </button>
              ))}
        </div>

        {/* Torob's «میخوای قسطی بخری؟» strip → push toward the assistant (Mohammad) */}
        <button
          type="button"
          onClick={onAsk}
          className="bg-brand-soft border-primary/20 mx-4 mt-2 flex items-center gap-3 rounded-lg border p-3 text-start"
        >
          <Sparkles className="text-primary size-5 shrink-0" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-brand-ink text-sm font-bold">نمی‌دونی دقیقاً چی می‌خوای؟</span>
            <span className="text-muted-foreground text-xs">به زبون خودت بنویس، دستیار می‌فهمه و می‌گرده</span>
          </span>
          <span className="bg-primary text-primary-foreground shrink-0 rounded-md px-2.5 py-1 text-xs font-bold">شروع</span>
        </button>

        {feed
          ? feed.rails.map((rail) => <RailView key={rail.key} rail={rail} onOpen={open} onRun={onRun} />)
          : !failed && <RailsSkeleton />}

        {(taste.saved.length > 0 || taste.viewed.length > 0 || taste.searches.length > 0) && (
          <p className="text-muted-foreground px-4 pt-6 text-center text-xs">
            پیشنهادها فقط از کارهای خودت روی همین گوشی ساخته می‌شن ·{" "}
            <button type="button" onClick={clearTaste} className="underline underline-offset-4">
              پاک کردن سابقه
            </button>
          </p>
        )}
      </section>

      <BottomNav savedCount={taste.saved.length} onAsk={onAsk} onSaved={() => setPanel({ kind: "saved" })} />

      <Sheet open={panel !== null} onOpenChange={(o) => !o && setPanel(null)}>
        <SheetContent side="bottom" className="max-h-[88svh] gap-0 overflow-y-auto rounded-t-2xl p-0">
          {panel?.kind === "detail" && (
            <div className="flex flex-col gap-3 p-4 pt-12">
              <SheetTitle className="sr-only">{panel.item.listing.title}</SheetTitle>
              <ListingCard result={panel.item} explanation={panel.item.explanation} explaining={false} aiExplained={false} />
            </div>
          )}
          {panel?.kind === "saved" && (
            <div className="flex flex-col gap-4 p-4">
              <SheetTitle className="text-lg font-bold">ذخیره‌شده‌ها</SheetTitle>
              {feed?.saved.length ? (
                <div className="grid grid-cols-2 gap-3">
                  {feed.saved.map((r) => (
                    <RailCard key={r.listing.id} item={{ ...r, signal: null }} onOpen={open} className="w-auto" />
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-center text-sm">
                  <Heart className="size-8" />
                  هنوز چیزی ذخیره نکردی. روی ♥ هر آگهی بزن تا اینجا بمونه و پیشنهادهای خانه از روش ساخته بشن.
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function RailView({ rail, onOpen, onRun }: { rail: Rail; onOpen: (r: SearchResult) => void; onRun: RunFn }) {
  const seeAll = rail.seeAll && (() => onRun(rail.seeAll!.query, rail.seeAll!.intent, rail.seeAll!.sort));
  return (
    <section className="flex flex-col gap-1 pt-5" aria-label={rail.title}>
      <header className="flex items-end justify-between gap-3 px-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-base font-extrabold">
            {rail.key === "picks" && <Sparkles className="text-primary size-4" />}
            {rail.title}
            {rail.badge && <span className="bg-primary text-primary-foreground rounded-full px-2 text-[11px] leading-5 font-bold">{rail.badge}</span>}
          </h2>
          {rail.subtitle && <p className="text-muted-foreground truncate text-xs">{rail.subtitle}</p>}
        </div>
        {seeAll && (
          <button type="button" onClick={seeAll} className="flex shrink-0 items-center text-primary text-xs font-medium">
            نمایش همه
            <ChevronLeft className="size-3.5" />
          </button>
        )}
      </header>
      {/* ~2 cards + a peek of the third: the strongest "swipe me" cue (NN/g) */}
      <div className="flex [scrollbar-width:none] snap-x snap-mandatory scroll-ps-4 gap-2.5 overflow-x-auto px-4 pt-2 pb-1">
        {rail.items.map((item) => (
          <RailCard key={item.listing.id} item={item} onOpen={onOpen} />
        ))}
        {seeAll && (
          <button
            type="button"
            onClick={seeAll}
            className="text-primary flex w-[28%] shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs font-medium"
          >
            <ChevronLeft className="size-5" />
            نمایش همه
          </button>
        )}
      </div>
    </section>
  );
}

const SIGNAL_TONE: Record<Signal["tone"], string> = {
  why: "bg-brand-soft text-brand-ink",
  deal: "bg-success/10 text-success",
  new: "bg-muted text-muted-foreground",
  muted: "bg-muted text-muted-foreground",
};

function RailCard({ item, onOpen, className }: { item: RailItem; onOpen: (r: SearchResult) => void; className?: string }) {
  const l = item.listing;
  const category = CATEGORIES[categoryOf(l)];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(item))}
      className={cn(
        "bg-card focus-visible:ring-ring/50 flex w-[44%] min-w-36 shrink-0 cursor-pointer snap-start flex-col overflow-hidden rounded-lg border text-start outline-none focus-visible:ring-3",
        className,
      )}
    >
      {/* the ad's photo over a calm tile with the category and the neighborhood (shown when there's no photo) */}
      <div className="relative aspect-[4/3]">
        <PhotoPlaceholder listing={l} label={l.neighborhood} />
        <ListingPhoto sources={photoSources(l)} className="absolute inset-0 size-full object-cover" />
        <SaveButton id={l.id} variant="overlay" className="absolute top-1.5 start-1.5" />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2">
        <h3 className="line-clamp-2 min-h-[2.6rem] text-[13px] leading-[1.3rem] font-bold">{l.title}</h3>
        <PriceLines item={item} />
        <p className="text-muted-foreground truncate text-[11px]">
          {toFaDigits(l.areaM2)} متر{category.residential && ` · ${roomsFa(l.rooms)}`} · {l.city}
        </p>
        {item.signal && (
          <span className={cn("mt-auto self-start rounded px-1.5 text-[11px] leading-5 font-bold", SIGNAL_TONE[item.signal.tone])}>
            {item.signal.text}
          </span>
        )}
      </div>
    </div>
  );
}

function PriceLines({ item }: { item: RailItem }) {
  const l = item.listing;
  const model = CATEGORIES[categoryOf(l)].priceModel;
  const cls = "text-[13px] leading-5 font-extrabold tabular-nums";
  if (model === "sale") return <p className={cls}>{formatToman(item.price)} تومان</p>;
  if (model === "nightly") return <p className={cls}>شبی {formatToman(item.price)}</p>;
  return (
    <div className={cls}>
      <p>{l.deposit ? `رهن ${formatToman(l.deposit)}` : "بدون رهن"}</p>
      <p className="text-muted-foreground font-bold">{l.monthlyRent ? `اجاره ${formatToman(l.monthlyRent)}` : "رهن کامل"}</p>
    </div>
  );
}

function RailsSkeleton() {
  return (
    <div className="flex flex-col gap-6 pt-5" aria-busy="true">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-2 px-4">
          <Skeleton className="h-5 w-32" />
          <div className="flex gap-2.5 overflow-hidden">
            {[0, 1, 2].map((j) => (
              <Skeleton key={j} className="aspect-[3/4] w-[44%] shrink-0 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Divar/Torob-style app frame. No «ثبت آگهی»: like Torob, we don't host ads. */
function BottomNav({ savedCount, onAsk, onSaved }: { savedCount: number; onAsk: () => void; onSaved: () => void }) {
  const item = "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px]";
  return (
    <nav
      aria-label="نوار پایین"
      className="bg-card text-foreground fixed inset-x-0 bottom-0 z-30 flex h-[calc(3.75rem+env(safe-area-inset-bottom,0px))] border-t pb-[env(safe-area-inset-bottom,0px)] sm:hidden"
    >
      <button type="button" className={cn(item, "text-primary font-bold")} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
        <House className="size-5" />
        خانه
      </button>
      <button type="button" className={cn(item, "font-medium")} onClick={onAsk}>
        <span className="bg-primary text-primary-foreground border-card -mt-5 grid size-11 place-items-center rounded-full border-4 shadow-md">
          <Sparkles className="size-5" />
        </span>
        دستیار هوشمند
      </button>
      <button type="button" className={cn(item, "text-muted-foreground")} onClick={onSaved}>
        <span className="relative">
          <Heart className="size-5" />
          {savedCount > 0 && (
            <span className="bg-primary text-primary-foreground absolute -top-1.5 -end-2.5 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 font-bold">
              {toFaDigits(savedCount)}
            </span>
          )}
        </span>
        ذخیره‌شده‌ها
      </button>
    </nav>
  );
}

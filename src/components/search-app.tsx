"use client";

import { GitCompareArrows, Info, LoaderCircle, RotateCcw, Search, SearchX, TriangleAlert, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CategoryTabs } from "@/components/category-tabs";
import { CompareDialog } from "@/components/compare-dialog";
import { HeroMap } from "@/components/hero-map/hero-map";
import { HomeFeed, useIsPhone } from "@/components/home-feed";
import { IntentChips } from "@/components/intent-chips";
import { PlaceLine, PlaceQuestion, rememberCity, withCity } from "@/components/place-hint";
import { TorobLogo } from "@/components/torob-logo";
import { ResultsView } from "@/components/results-view";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SearchApiResponse, SearchIntent } from "@/lib/api-types";
import { CATEGORIES, DEFAULT_CATEGORY, priceModelOf } from "@/lib/categories";
import { withCategory } from "@/lib/intent/category";
import { toFaDigits } from "@/lib/persian";
import { isCovered } from "@/lib/places";
import { clampRanges, domains, EMPTY_REFINE, type Refine, type SortKey } from "@/lib/search/refine";
import { rememberSearch } from "@/lib/taste-store";
import { cn } from "@/lib/utils";
import { detectPlace } from "@/lib/where";

const COMPARE_MAX = 3;

type Status = "idle" | "loading" | "done" | "error";

export function SearchApp() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [data, setData] = useState<SearchApiResponse | null>(null);
  const [refine, setRefine] = useState<Refine>(EMPTY_REFINE);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const requestId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const phone = useIsPhone();
  // hand-set price ranges only make sense within one price model (rahn, a sale price, a night)
  const priceModel = useRef(priceModelOf(null));

  const run = useCallback(async (q: string, intent?: SearchIntent, sort?: SortKey) => {
    const text = q.trim();
    if (text.length < 2) return;
    const id = ++requestId.current;
    setStatus("loading");
    setCompareIds([]);
    if (!intent) window.history.replaceState(null, "", `?q=${encodeURIComponent(text)}`);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: text, intent }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: SearchApiResponse = await res.json();
      if (id !== requestId.current) return; // a newer search started
      rememberCity(json.intent.city);
      // typed searches feed the phone home's recent chips and «ادامهٔ جستجو» rail
      if (!intent) rememberSearch({ query: json.query, intent: json.intent, at: Date.now() });
      setData(json);
      // a new query starts clean; editing the AI intent keeps the hand-set filters that still apply
      const model = priceModelOf(json.intent.category);
      const sameModel = model === priceModel.current;
      priceModel.current = model;
      setRefine((prev) => {
        const next =
          intent && sameModel ? clampRanges(prev, domains(json.results, model)) : intent ? { ...EMPTY_REFINE, sort: prev.sort } : EMPTY_REFINE;
        return sort ? { ...next, sort } : next;
      });
      setStatus("done");
    } catch {
      if (id === requestId.current) setStatus("error");
    }
  }, []);

  // Shareable URLs: /?q=... runs the search on load.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync the input with the URL once on mount
      setQuery(q);
      void run(q);
    }
  }, [run]);

  const submit = (q: string) => {
    setQuery(q);
    void run(q);
  };

  const reset = () => {
    requestId.current++;
    setStatus("idle");
    setData(null);
    setQuery("");
    setCompareIds([]);
    window.history.replaceState(null, "", "/");
  };

  const compact = status !== "idle";

  // phone home: a rail's «نمایش همه» / a recent chip runs its search; the assistant focuses the box
  const runFromHome = (q: string, intent?: SearchIntent, sort?: SortKey) => {
    setQuery(q);
    window.scrollTo({ top: 0 });
    void run(q, intent, sort);
  };
  const ask = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    inputRef.current?.focus({ preventScroll: true });
  };
  // Where the text in the box points to — instant, offline, recomputed on every keystroke.
  const guess = useMemo(() => detectPlace(query), [query]);
  // Show it while writing a new query (not under the one the results are already for).
  const typing = status === "idle" || query.trim() !== data?.query;

  const addCity = (city: string) => {
    const next = withCity(query, city);
    setQuery(next);
    // on the home page let them keep writing; on results, search again right away
    if (compact) void run(next);
  };

  return (
    <>
      {!compact && <HeroMap className="z-0" focus={query.trim().length >= 3 ? guess : undefined} />}
      <div
        className={cn(
          "relative z-10 mx-auto flex w-full flex-1 flex-col gap-6 px-4 pt-6 transition-[max-width] duration-500 sm:pt-10",
          status === "done" && data?.total ? "max-w-7xl" : "max-w-5xl",
          compareIds.length ? "pb-28" : "pb-16",
          !compact && "dark text-foreground pt-16 sm:pt-16",
          // phone home: the first screen is logo + search; the feed sheet peeks in below it
          !compact && phone && "min-h-[72svh] flex-none",
        )}
      >
        {/* results: torob.com's white header band (full-bleed via shadow + clip-path, no horizontal scroll) */}
        <div
          className={cn(
            "flex flex-col gap-6",
            compact && "bg-card -mt-6 pt-6 pb-5 shadow-[0_0_0_100vmax_var(--color-card)] [clip-path:inset(0_-100vmax)] sm:-mt-10 sm:pt-10",
          )}
        >
          <header className={cn("flex flex-col gap-3 transition-all", compact ? "items-start" : "items-center pt-10 text-center sm:pt-20")}>
            <button
              type="button"
              onClick={reset}
              data-hero-block
              className={cn("flex", compact ? "items-center gap-3" : "flex-col items-center")}
              aria-label="صفحهٔ اول"
            >
              {compact ? (
                // torob.com's header: the mark with a 24px/700 «ترب» in the logo red
                <span className="flex items-center gap-1.5">
                  <TorobLogo className="size-9" />
                  <span className="text-2xl font-bold text-(--logo-color-1)">ترب</span>
                </span>
              ) : (
                // torob.com's home: the 88px mark sits right on top of a 40px bold «ترب» (monochrome in dark).
                <>
                  <TorobLogo className="size-18 sm:size-22" />
                  <span className="text-[40px] leading-[1.6] font-bold">ترب</span>
                </>
              )}
            </button>
          </header>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(query);
            }}
            data-hero-block
            className={cn("flex w-full flex-col gap-2 sm:flex-row sm:gap-0", !compact && "mx-auto max-w-2xl")}
          >
            {/* torob.com's search box: 48px, 8px radius, 1px border, search icon inside at the start; on wider
                screens the red submit is attached to it (input rounded on the start side, button on the end) */}
            <div className="relative sm:flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute start-3.5 top-1/2 size-5 -translate-y-1/2" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="مثلاً: دوخوابه وکیل‌آباد، ۵۰۰ رهن"
                className={cn(
                  "border-input focus-visible:border-ring focus-visible:ring-ring/40 h-12 w-full rounded-lg border ps-12 pe-4 text-base outline-none focus-visible:ring-3 sm:rounded-e-none sm:border-e-0",
                  compact ? "bg-secondary" : "bg-card",
                )}
                aria-label="چی می‌خوای؟"
                maxLength={300}
              />
            </div>
            <Button type="submit" size="lg" className="h-12 rounded-lg px-6 text-base font-bold sm:rounded-s-none" disabled={status === "loading"}>
              {status === "loading" ? <LoaderCircle className="animate-spin" /> : <Search />}
              جستجو
            </Button>
          </form>
          {typing && (
            <PlaceLine
              query={query}
              guess={guess}
              onAddCity={addCity}
              className={cn("-mt-3", !compact && "mx-auto w-full max-w-2xl justify-center")}
            />
          )}
        </div>

        {status === "loading" && <LoadingState />}
        {status === "error" && <ErrorState onRetry={() => run(query)} />}
        {status === "done" && data && (
          <section className="flex flex-col gap-5">
            <CategoryTabs
              value={data.intent.category ?? DEFAULT_CATEGORY}
              onChange={(k) => run(data.query, withCategory(data.intent, k))}
            />
            <IntentChips intent={data.intent} source={data.meta.intentSource} onChange={(next) => run(data.query, next)} />
            <PlaceQuestion
              data={data}
              onAddCity={(city) => {
                const next = withCity(data.query, city);
                setQuery(next);
                void run(next);
              }}
            />
            <ExcludedNote data={data} onShowShared={() => run(data.query, { ...data.intent, sharedRoom: true })} />
            {data.total === 0 ? (
              <EmptyState data={data} onApply={(intent) => run(data.query, intent)} />
            ) : (
              <ResultsView
                key={data.query + JSON.stringify(data.intent)}
                data={data}
                refine={refine}
                onRefine={setRefine}
                onIntentChange={(next) => run(data.query, next)}
                compareIds={compareIds}
                compareMax={COMPARE_MAX}
                onToggleCompare={(id) =>
                  setCompareIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(0, COMPARE_MAX)))
                }
              />
            )}
          </section>
        )}

        {status === "done" && data && compareIds.length > 0 && (
          <>
            <div className="bg-popover fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center gap-2 rounded-2xl border p-2 ps-4 shadow-lg">
              <span className="flex-1 text-sm font-medium">
                {toFaDigits(compareIds.length)} آگهی انتخاب شده
                {compareIds.length < 2 && <span className="text-muted-foreground text-xs"> — یکی دیگه انتخاب کن</span>}
              </span>
              <Button size="sm" disabled={compareIds.length < 2} onClick={() => setCompareOpen(true)}>
                <GitCompareArrows />
                مقایسه
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="لغو مقایسه" onClick={() => setCompareIds([])}>
                <X />
              </Button>
            </div>
            <CompareDialog
              open={compareOpen}
              onOpenChange={setCompareOpen}
              items={compareIds
                .map((id) => data.results.find((r) => r.listing.id === id))
                .filter((r): r is NonNullable<typeof r> => Boolean(r))}
            />
          </>
        )}

        {/* Home page: logo + search box only (owner). The home map's credit (geoBoundaries, CC BY 4.0)
            lives here on the results page and in the README. */}
        {compact && (
          <footer className="text-muted-foreground mt-auto border-t pt-6 text-center text-xs leading-6">
            این یک نسخهٔ نمایشی است: آگهی‌ها نمونه و ساختگی‌اند.
            هوش مصنوعی درخواستت رو به فیلتر تبدیل می‌کنه، قیمت‌ها رو با تبدیل رهن و اجاره (هر ۱ میلیون رهن = ۳۰ هزار
            تومان اجاره) هم‌تراز می‌کنه و برای هر نتیجه دلیل می‌نویسه.
            <span className="block opacity-60">نقشهٔ صفحهٔ اول: geoBoundaries (CC BY 4.0)</span>
          </footer>
        )}
      </div>
      {!compact && phone && <HomeFeed onRun={runFromHome} onAsk={ask} />}
    </>
  );
}

function ExcludedNote({ data, onShowShared }: { data: SearchApiResponse; onShowShared: () => void }) {
  const { placeholderPrice, sharedRoom } = data.excluded;
  if (!placeholderPrice && !(sharedRoom && !data.intent.sharedRoom)) return null;
  return (
    <div className="text-muted-foreground flex flex-col gap-1 text-xs leading-6">
      {placeholderPrice > 0 && (
        <p className="flex items-start gap-1.5">
          <Info className="mt-1 size-3.5 shrink-0" />
          {toFaDigits(placeholderPrice)} آگهی قیمت واقعی نداشت (توافقی یا عدد نمایشی مثل «۱٬۰۰۰ تومان») و در رتبه‌بندی و میانهٔ قیمت‌ها حساب نشد.
        </p>
      )}
      {sharedRoom > 0 && !data.intent.sharedRoom && (
        <p className="flex items-start gap-1.5">
          <Info className="mt-1 size-3.5 shrink-0" />
          <span>
            {toFaDigits(sharedRoom)} آگهی «اجاره اتاق / همخونه» هم هست که جدا نگهشون داشتم (قیمتشون برای یه اتاقه، نه کل واحد).{" "}
            <button type="button" onClick={onShowShared} className="text-primary font-medium underline-offset-4 hover:underline">
              نشونم بده
            </button>
          </span>
        </p>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <LoaderCircle className="text-primary size-4 animate-spin" />
          دارم می‌فهمم دنبال چی هستی…
        </p>
        <div className="flex gap-2">
          {[80, 110, 70, 95].map((w) => (
            <Skeleton key={w} className="h-8 rounded-full" style={{ width: w }} />
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-4 rounded-2xl border p-5">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ data, onApply }: { data: SearchApiResponse; onApply: (i: SearchIntent) => void }) {
  const hasBudget = data.intent.maxDeposit !== null || data.intent.maxRent !== null || data.intent.maxPrice !== null;
  const newCity = data.intent.city && !isCovered(data.intent.city) ? data.intent.city : null;
  const category = CATEGORIES[data.intent.category ?? DEFAULT_CATEGORY];
  const [title, hint] = !data.categoryCount && data.intent.category && data.intent.category !== DEFAULT_CATEGORY
    ? [
        `هنوز آگهی «${category.label}»${data.intent.city ? ` در ${data.intent.city}` : ""} نداریم`,
        `ترب دسته‌به‌دسته آگهی‌های واقعی رو اضافه می‌کنه (${category.types.join("، ")}).`,
      ]
    : newCity
    ? [`هنوز آگهی‌ای از ${newCity} نداریم`, "ترب شهربه‌شهر آگهی‌های واقعی رو اضافه می‌کنه."]
    : hasBudget
      ? ["هیچ آگهی‌ای با این بودجه نیست", category.priceModel === "rent" ? "قیمت‌ها از بودجه‌ات بالاترن، حتی با جابجایی رهن و اجاره." : "قیمت‌ها از بودجه‌ات بالاترن."]
      : ["آگهی‌ای پیدا نشد", "فیلترها رو کمتر کن یا جور دیگه‌ای بنویس."];
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed px-6 py-12 text-center">
      <SearchX className="text-muted-foreground size-10" />
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-muted-foreground text-sm">{hint}</p>
      </div>
      {data.suggestion && (
        <Button variant="outline" className="h-auto rounded-xl px-4 py-2.5 text-sm whitespace-normal" onClick={() => onApply(data.suggestion!.intent)}>
          {data.suggestion.text} — نشونم بده
        </Button>
      )}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed px-6 py-12 text-center">
      <TriangleAlert className="text-warning size-10" />
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold">یه مشکلی پیش اومد</h2>
        <p className="text-muted-foreground text-sm">اتصال رو چک کن و دوباره امتحان کن.</p>
      </div>
      <Button variant="outline" onClick={onRetry}>
        <RotateCcw />
        دوباره
      </Button>
    </div>
  );
}

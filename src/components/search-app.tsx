"use client";

import { GitCompareArrows, Info, LoaderCircle, RotateCcw, Search, SearchX, TriangleAlert, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { CompareDialog } from "@/components/compare-dialog";
import { HeroMap } from "@/components/hero-map/hero-map";
import { IntentChips } from "@/components/intent-chips";
import { TorobLogo } from "@/components/torob-logo";
import { ResultsView } from "@/components/results-view";
import { readStoredPlace, useUserPlace } from "@/components/use-user-place";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SearchApiResponse, SearchIntent } from "@/lib/api-types";
import type { UserPlace } from "@/lib/geo";
import type { HoodStat } from "@/lib/hood-stats";
import { toFaDigits } from "@/lib/persian";
import { clampRanges, domains, EMPTY_REFINE, type Refine } from "@/lib/search/refine";
import { cn } from "@/lib/utils";

const COMPARE_MAX = 3;

type Status = "idle" | "loading" | "done" | "error";

export function SearchApp({ hoodStats }: { hoodStats: { total: number; hoods: HoodStat[] } }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [data, setData] = useState<SearchApiResponse | null>(null);
  const [refine, setRefine] = useState<Refine>(EMPTY_REFINE);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const requestId = useRef(0);
  const { status: placeStatus, place } = useUserPlace();
  const near = useRef<UserPlace["neighborhood"]>(null);
  useEffect(() => {
    near.current = place?.neighborhood ?? null;
  }, [place]);

  const run = useCallback(async (q: string, intent?: SearchIntent) => {
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
        body: JSON.stringify({ query: text, intent, near: near.current ?? undefined }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: SearchApiResponse = await res.json();
      if (id !== requestId.current) return; // a newer search started
      setData(json);
      // a new query starts clean; editing the AI intent keeps the hand-set filters that still apply
      setRefine((prev) => (intent ? clampRanges(prev, domains(json.results)) : EMPTY_REFINE));
      setStatus("done");
    } catch {
      if (id === requestId.current) setStatus("error");
    }
  }, []);

  // Shareable URLs: /?q=... runs the search on load.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      near.current = readStoredPlace()?.neighborhood ?? null;
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
  // Listings exist only for Mashhad; elsewhere the title stays on Mashhad and the pill says so.

  return (
    <>
      {!compact && <HeroMap stats={hoodStats} placeStatus={placeStatus} place={place} className="z-0" />}
      <div
        className={cn(
          "relative z-10 mx-auto flex w-full flex-1 flex-col gap-6 px-4 pt-6 transition-[max-width] duration-500 sm:pt-10",
          status === "done" && data?.total ? "max-w-7xl" : "max-w-5xl",
          compareIds.length ? "pb-28" : "pb-16",
          !compact && "dark text-foreground pt-16 sm:pt-16",
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
          className={cn("flex w-full flex-col gap-2 sm:flex-row", !compact && "mx-auto max-w-2xl")}
        >
          {/* torob.com's search box: 48px, 8px radius, 1px border, search icon inside at the start */}
          <div className="relative sm:flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute start-3.5 top-1/2 size-5 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="مثلاً: دوخوابه وکیل‌آباد، ۵۰۰ رهن"
              className="border-input focus-visible:border-ring focus-visible:ring-ring/40 bg-card h-12 w-full rounded-lg border ps-12 pe-4 text-base outline-none focus-visible:ring-3"
              aria-label="چی می‌خوای؟"
              maxLength={300}
            />
          </div>
          <Button type="submit" size="lg" className="h-12 rounded-lg px-6 text-base font-bold" disabled={status === "loading"}>
            {status === "loading" ? <LoaderCircle className="animate-spin" /> : <Search />}
            جستجو
          </Button>
        </form>

        {status === "loading" && <LoadingState />}
        {status === "error" && <ErrorState onRetry={() => run(query)} />}
        {status === "done" && data && (
          <section className="flex flex-col gap-5">
            <IntentChips intent={data.intent} source={data.meta.intentSource} onChange={(next) => run(data.query, next)} />
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

        <footer data-hero-block className={cn("text-muted-foreground mt-auto text-center text-xs leading-6", compact ? "border-t pt-6" : "pt-4")}>
          {compact ? (
            <>
              آگهی‌ها از دیوار و شیپور جمع‌آوری شده‌اند؛ برای دیدن آگهی اصلی روی نام سایت بزنید.
              هوش مصنوعی درخواستت رو به فیلتر تبدیل می‌کنه، قیمت‌ها رو با تبدیل رهن و اجاره (هر ۱ میلیون رهن = ۳۰ هزار
              تومان اجاره) هم‌تراز می‌کنه و برای هر نتیجه دلیل می‌نویسه.
            </>
          ) : (
            // map credit only: OSM's license (ODbL) requires it wherever the map is shown
            <span className="opacity-60">نقشه: © OpenStreetMap و geoBoundaries</span>
          )}
        </footer>
      </div>
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
  const hasBudget = data.intent.maxDeposit !== null || data.intent.maxRent !== null;
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed px-6 py-12 text-center">
      <SearchX className="text-muted-foreground size-10" />
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold">{hasBudget ? "هیچ آگهی‌ای با این بودجه نیست" : "آگهی‌ای پیدا نشد"}</h2>
        <p className="text-muted-foreground text-sm">
          {hasBudget ? "قیمت‌ها از بودجه‌ات بالاترن، حتی با جابجایی رهن و اجاره." : "فیلترها رو کمتر کن یا جور دیگه‌ای بنویس."}
        </p>
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

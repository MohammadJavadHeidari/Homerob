"use client";

import { GitCompareArrows, Info, ListOrdered, LoaderCircle, LocateFixed, MapPin, MessageSquareText, RotateCcw, Search, SearchX, Sparkles, TriangleAlert, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { CompareDialog } from "@/components/compare-dialog";
import { HeroMap } from "@/components/hero-map/hero-map";
import { IntentChips } from "@/components/intent-chips";
import { ResultsView } from "@/components/results-view";
import { readStoredPlace, useUserPlace, type PlaceStatus } from "@/components/use-user-place";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SearchApiResponse, SearchIntent } from "@/lib/api-types";
import { DEMO_QUERIES } from "@/lib/demo-queries";
import { SUPPORTED_CITY, type LatLng, type UserPlace } from "@/lib/geo";
import type { HoodStat } from "@/lib/hood-stats";
import { toFaDigits } from "@/lib/persian";
import { clampRanges, domains, EMPTY_REFINE, type Refine } from "@/lib/search/refine";
import { cn } from "@/lib/utils";

const COMPARE_MAX = 3;

const atOf = (p: UserPlace | null): LatLng | null => (p?.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null);
const HERO_EXAMPLES = DEMO_QUERIES.slice(0, 6);

type Status = "idle" | "loading" | "done" | "error";

export function SearchApp({
  hoodStats,
  coveredCities,
}: {
  hoodStats: { total: number; hoods: HoodStat[] };
  /** Persian names of the cities that have listings. */
  coveredCities: string[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [data, setData] = useState<SearchApiResponse | null>(null);
  const [refine, setRefine] = useState<Refine>(EMPTY_REFINE);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const requestId = useRef(0);
  const { status: placeStatus, place: rawPlace, request: requestPlace } = useUserPlace(coveredCities);
  const place = rawPlace && { ...rawPlace, supported: rawPlace.city !== null && coveredCities.includes(rawPlace.city) };
  const at = useRef<LatLng | null>(null);
  useEffect(() => {
    at.current = atOf(rawPlace);
  }, [rawPlace]);

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
        body: JSON.stringify({ query: text, intent, at: at.current ?? undefined }),
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
      at.current = atOf(readStoredPlace());
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
  // After a search: the city it ran in. Before: the user's city when covered, else Mashhad.
  const city =
    (status === "done" && data?.cityFa) ||
    (place?.supported ? place.city : placeStatus === "idle" || placeStatus === "locating" ? null : SUPPORTED_CITY);

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
          <button type="button" onClick={reset} data-hero-block className="flex items-baseline gap-2" aria-label="صفحهٔ اول">
            <span className={cn("font-extrabold tracking-tight", compact ? "text-2xl" : "text-5xl sm:text-6xl")}>
              هوم<span className="text-primary">راب</span>
            </span>
            {compact && (
              <span className="text-muted-foreground hidden text-sm sm:inline">جستجوی هوشمند اجاره در {city ?? SUPPORTED_CITY}</span>
            )}
          </button>
          {!compact && (
            <>
              <h1 data-hero-block className="text-xl font-bold sm:text-2xl">
                جستجوی هوشمند اجاره
                <span className={cn("transition-opacity duration-500", city ? "opacity-100" : "opacity-0")}>
                  {" "}در <span className="text-primary">{city ?? SUPPORTED_CITY}</span>
                </span>
              </h1>
              <PlacePill status={placeStatus} place={place} onRetry={requestPlace} />
              <p data-hero-block className="text-muted-foreground max-w-xl text-base sm:text-lg">
                نیازت رو به زبان خودت بنویس؛ هومراب آگهی‌های واقعی رهن و اجارهٔ دیوار رو برات پیدا، مقایسه و رتبه‌بندی می‌کنه.
              </p>
            </>
          )}
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(query);
          }}
          data-hero-block
          className={cn("flex w-full flex-col gap-2 sm:flex-row", !compact && "mx-auto max-w-2xl")}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="مثلاً: یه دوخوابه نزدیک وکیل‌آباد با ۵۰۰ میلیون رهن…"
            className="border-input focus-visible:border-ring focus-visible:ring-ring/40 bg-background/80 backdrop-blur-md h-12 w-full rounded-xl border px-4 text-base shadow-xs outline-none focus-visible:ring-3 sm:h-14 sm:flex-1 sm:text-lg"
            aria-label="چی می‌خوای؟"
            maxLength={300}
          />
          <Button type="submit" size="lg" className="h-12 rounded-xl px-6 text-base sm:h-14" disabled={status === "loading"}>
            {status === "loading" ? <LoaderCircle className="animate-spin" /> : <Search />}
            جستجو
          </Button>
        </form>

        {!compact && (
          <div data-hero-block className="mx-auto flex max-w-3xl flex-col items-center gap-3">
            <p className="text-muted-foreground text-sm">یا یکی از این‌ها رو امتحان کن:</p>
            <ul className="flex flex-wrap justify-center gap-2">
              {HERO_EXAMPLES.map((q) => (
                <li key={q}>
                  <button
                    type="button"
                    onClick={() => submit(q)}
                    className="bg-muted/70 backdrop-blur-md hover:bg-primary/15 hover:text-primary text-muted-foreground rounded-full px-3.5 py-2 text-sm transition-colors"
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!compact && <HowItWorks />}

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

        <footer data-hero-block className="text-muted-foreground mt-auto border-t pt-6 text-center text-xs leading-6">
          هومراب یک نسخهٔ نمایشی است: آگهی‌ها نمونه و ساختگی‌اند (به سبک دیوار و شیپور، بدون کپی از این سایت‌ها).
          هوش مصنوعی درخواستت رو به فیلتر تبدیل می‌کنه، قیمت‌ها رو با تبدیل رهن و اجاره (هر ۱ میلیون رهن = ۳۰ هزار
          تومان اجاره) هم‌تراز می‌کنه و برای هر نتیجه دلیل می‌نویسه.
          {!compact && <span className="block opacity-60">نقشه: © مشارکت‌کنندگان OpenStreetMap و geoBoundaries</span>}
        </footer>
      </div>
    </>
  );
}

function PlacePill({ status, place, onRetry }: { status: PlaceStatus; place: UserPlace | null; onRetry: () => void }) {
  const base = "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm";
  if (status === "idle") return <span className={cn(base, "invisible")}>…</span>;
  if (status === "locating") {
    return (
      <span className={cn(base, "bg-muted text-muted-foreground")}>
        <LoaderCircle className="size-4 animate-spin" />
        دارم موقعیتت رو پیدا می‌کنم…
      </span>
    );
  }
  if (place?.supported && place.neighborhood) {
    return (
      <span className={cn(base, "bg-sky-500/10 text-sky-700 dark:text-sky-300")}>
        <MapPin className="size-4" />
        <span>
          نتایج برای اطراف <b className="font-bold">{place.neighborhood}</b>، نزدیک خودت
        </span>
      </span>
    );
  }
  if (place?.supported && place.city) {
    return (
      <span className={cn(base, "bg-sky-500/10 text-sky-700 dark:text-sky-300")}>
        <MapPin className="size-4" />
        <span>
          نتایج برای <b className="font-bold">{place.city}</b>، نزدیک خودت
        </span>
      </span>
    );
  }
  if (place && !place.supported) {
    return (
      <span className={cn(base, "bg-muted text-muted-foreground max-w-xl text-center")}>
        <MapPin className="size-4 shrink-0" />
        {place.city ? `${place.city} هنوز پوشش داده نمی‌شه` : "شهرت هنوز پوشش داده نمی‌شه"}؛ فعلاً آگهی‌های {SUPPORTED_CITY} رو ببین
      </span>
    );
  }
  return (
    <button type="button" onClick={onRetry} className={cn(base, "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors")}>
      <LocateFixed className="size-4" />
      نتایج نزدیک من
    </button>
  );
}

function HowItWorks() {
  const steps = [
    { icon: MessageSquareText, title: "بنویس چی می‌خوای", text: "بودجه، محله، تعداد خواب — هر جور راحتی" },
    { icon: Sparkles, title: "هوش مصنوعی می‌فهمه", text: "و به فیلتر تبدیلش می‌کنه؛ هر کدوم رو خواستی حذف کن" },
    { icon: ListOrdered, title: "بهترین‌ها با دلیل", text: "رهن و اجاره هم‌تراز می‌شن و هر آگهی می‌گه چرا به دردت می‌خوره" },
  ];
  return (
    <ol data-hero-block className="mx-auto mt-4 grid w-full max-w-3xl gap-3 sm:grid-cols-3">
      {steps.map(({ icon: Icon, title, text }, i) => (
        <li key={title} className="bg-card/60 flex gap-3 rounded-2xl border p-4 backdrop-blur-md">
          <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
            <Icon className="size-4.5" />
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold">
              {toFaDigits(i + 1)}. {title}
            </span>
            <span className="text-muted-foreground text-xs leading-5">{text}</span>
          </div>
        </li>
      ))}
    </ol>
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

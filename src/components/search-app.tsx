"use client";

import { ListOrdered, LoaderCircle, MessageSquareText, RotateCcw, Search, SearchX, Sparkles, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { IntentChips } from "@/components/intent-chips";
import { ResultsView } from "@/components/results-view";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SearchApiResponse, SearchIntent } from "@/lib/api-types";
import { DEMO_QUERIES } from "@/lib/demo-queries";
import { toFaDigits } from "@/lib/persian";
import { clampRanges, domains, EMPTY_REFINE, type Refine } from "@/lib/search/refine";
import { cn } from "@/lib/utils";

const HERO_EXAMPLES = DEMO_QUERIES.slice(0, 6);

type Status = "idle" | "loading" | "done" | "error";

export function SearchApp() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [data, setData] = useState<SearchApiResponse | null>(null);
  const [refine, setRefine] = useState<Refine>(EMPTY_REFINE);
  const requestId = useRef(0);

  const run = useCallback(async (q: string, intent?: SearchIntent) => {
    const text = q.trim();
    if (text.length < 2) return;
    const id = ++requestId.current;
    setStatus("loading");
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
    window.history.replaceState(null, "", "/");
  };

  const compact = status !== "idle";

  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-1 flex-col gap-6 px-4 pt-6 pb-16 transition-[max-width] duration-500 sm:pt-10",
        status === "done" && data?.total ? "max-w-7xl" : "max-w-5xl",
      )}
    >
      <header className={cn("flex flex-col gap-3 transition-all", compact ? "items-start" : "items-center pt-10 text-center sm:pt-20")}>
        <button type="button" onClick={reset} className="flex items-baseline gap-2" aria-label="صفحهٔ اول">
          <span className={cn("font-extrabold tracking-tight", compact ? "text-2xl" : "text-5xl sm:text-6xl")}>
            هوم<span className="text-primary">راب</span>
          </span>
          {compact && <span className="text-muted-foreground hidden text-sm sm:inline">جستجوی هوشمند اجاره در مشهد</span>}
        </button>
        {!compact && (
          <p className="text-muted-foreground max-w-xl text-base sm:text-lg">
            نیازت رو به زبان خودت بنویس؛ هومراب آگهی‌های رهن و اجارهٔ دیوار و شیپور رو برات پیدا، مقایسه و رتبه‌بندی می‌کنه.
          </p>
        )}
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
        className={cn("flex w-full flex-col gap-2 sm:flex-row", !compact && "mx-auto max-w-2xl")}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="مثلاً: یه دوخوابه نزدیک وکیل‌آباد با ۵۰۰ میلیون رهن…"
          className="border-input focus-visible:border-ring focus-visible:ring-ring/40 bg-background h-12 w-full rounded-xl border px-4 text-base shadow-xs outline-none focus-visible:ring-3 sm:h-14 sm:flex-1 sm:text-lg"
          aria-label="چی می‌خوای؟"
          maxLength={300}
        />
        <Button type="submit" size="lg" className="h-12 rounded-xl px-6 text-base sm:h-14" disabled={status === "loading"}>
          {status === "loading" ? <LoaderCircle className="animate-spin" /> : <Search />}
          جستجو
        </Button>
      </form>

      {!compact && (
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3">
          <p className="text-muted-foreground text-sm">یا یکی از این‌ها رو امتحان کن:</p>
          <ul className="flex flex-wrap justify-center gap-2">
            {HERO_EXAMPLES.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => submit(q)}
                  className="bg-muted hover:bg-primary/10 hover:text-primary text-muted-foreground rounded-full px-3.5 py-2 text-sm transition-colors"
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
          {data.total === 0 ? (
            <EmptyState data={data} onApply={(intent) => run(data.query, intent)} />
          ) : (
            <ResultsView
              key={data.query + JSON.stringify(data.intent)}
              data={data}
              refine={refine}
              onRefine={setRefine}
              onIntentChange={(next) => run(data.query, next)}
            />
          )}
        </section>
      )}

      <footer className="text-muted-foreground mt-auto border-t pt-6 text-center text-xs leading-6">
        هومراب یک نسخهٔ نمایشی است: آگهی‌ها نمونه و ساختگی‌اند (به سبک دیوار و شیپور، بدون کپی از این سایت‌ها).
        هوش مصنوعی درخواستت رو به فیلتر تبدیل می‌کنه، قیمت‌ها رو با تبدیل رهن و اجاره (هر ۱ میلیون رهن = ۳۰ هزار
        تومان اجاره) هم‌تراز می‌کنه و برای هر نتیجه دلیل می‌نویسه.
      </footer>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { icon: MessageSquareText, title: "بنویس چی می‌خوای", text: "بودجه، محله، تعداد خواب — هر جور راحتی" },
    { icon: Sparkles, title: "هوش مصنوعی می‌فهمه", text: "و به فیلتر تبدیلش می‌کنه؛ هر کدوم رو خواستی حذف کن" },
    { icon: ListOrdered, title: "بهترین‌ها با دلیل", text: "رهن و اجاره هم‌تراز می‌شن و هر آگهی می‌گه چرا به دردت می‌خوره" },
  ];
  return (
    <ol className="mx-auto mt-4 grid w-full max-w-3xl gap-3 sm:grid-cols-3">
      {steps.map(({ icon: Icon, title, text }, i) => (
        <li key={title} className="bg-card flex gap-3 rounded-2xl border p-4">
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

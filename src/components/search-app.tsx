"use client";

import { LoaderCircle, RotateCcw, Search, SearchX, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { IntentChips } from "@/components/intent-chips";
import { ListingCard } from "@/components/listing-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExplainApiResponse, SearchApiResponse, SearchIntent } from "@/lib/api-types";
import { DEMO_QUERIES } from "@/lib/demo-queries";
import { toFaDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

const EXPLAIN_TOP = 10;
const HERO_EXAMPLES = DEMO_QUERIES.slice(0, 6);

type Status = "idle" | "loading" | "done" | "error";

export function SearchApp() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [data, setData] = useState<SearchApiResponse | null>(null);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [explainState, setExplainState] = useState<"idle" | "loading" | "ai" | "rules">("idle");
  const requestId = useRef(0);

  const run = useCallback(async (q: string, intent?: SearchIntent) => {
    const text = q.trim();
    if (text.length < 2) return;
    const id = ++requestId.current;
    setStatus("loading");
    setExplainState("idle");
    setExplanations({});
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
      setStatus("done");

      const top = json.results.slice(0, EXPLAIN_TOP);
      if (!top.length) return;
      setExplainState("loading");
      const ex = await fetch("/api/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: text, intent: json.intent, ids: top.map((r) => r.listing.id) }),
      })
        .then((r) => (r.ok ? (r.json() as Promise<ExplainApiResponse>) : null))
        .catch(() => null);
      if (id !== requestId.current) return;
      if (ex) setExplanations(ex.byId);
      setExplainState(ex?.source === "ai" ? "ai" : "rules");
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
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pt-6 pb-16 sm:pt-10">
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

      {status === "loading" && <LoadingState />}
      {status === "error" && <ErrorState onRetry={() => run(query)} />}
      {status === "done" && data && (
        <section className="flex flex-col gap-5">
          <IntentChips intent={data.intent} source={data.meta.intentSource} onChange={(next) => run(data.query, next)} />
          {data.total === 0 ? (
            <EmptyState data={data} onApply={(intent) => run(data.query, intent)} />
          ) : (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-3">
                <h2 className="text-lg font-bold">
                  {toFaDigits(data.total)} آگهی با بودجه‌ات جور است
                  {data.total > data.results.length && (
                    <span className="text-muted-foreground ms-2 text-sm font-normal">({toFaDigits(data.results.length)} تای برتر)</span>
                  )}
                </h2>
                <p className="text-muted-foreground text-xs">مرتب‌شده بر اساس تطابق با نیازت</p>
              </div>
              <ol className="grid gap-4 md:grid-cols-2">
                {data.results.map((r, i) => {
                  const id = r.listing.id;
                  const inTop = i < EXPLAIN_TOP;
                  return (
                    <li key={id}>
                      <ListingCard
                        result={r}
                        rank={i + 1}
                        explanation={explanations[id] ?? r.explanation}
                        explaining={inTop && explainState === "loading"}
                        aiExplained={explainState === "ai" && inTop}
                      />
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </section>
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

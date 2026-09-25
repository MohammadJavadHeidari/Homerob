"use client";

import { ChevronDown, FilterX, SlidersHorizontal, X } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion, MotionConfig } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AnimatedNumber, FilterPanel } from "@/components/filter-panel";
import { ListingCard } from "@/components/listing-card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { AMENITIES } from "@/lib/amenities";
import type { ExplainApiResponse, SearchApiResponse, SearchIntent } from "@/lib/api-types";
import { formatToman, toFaDigits } from "@/lib/persian";
import { activeCount, applyRefine, domains as domainsOf, EMPTY_REFINE, SORTS, type Refine, type SortKey } from "@/lib/search/refine";
import { cn } from "@/lib/utils";

const EXPLAIN_TOP = 10;
const PAGE = 12;
const SPRING = { type: "spring", stiffness: 380, damping: 32 } as const;

type Explained = { text: string | null; ai: boolean };

export function ResultsView({
  data,
  refine,
  onRefine,
  onIntentChange,
  compareIds,
  compareMax,
  onToggleCompare,
}: {
  data: SearchApiResponse;
  refine: Refine;
  onRefine: (next: Refine) => void;
  onIntentChange: (next: SearchIntent) => void;
  compareIds: string[];
  compareMax: number;
  onToggleCompare: (id: string) => void;
}) {
  const [pages, setPages] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const domains = useMemo(() => domainsOf(data.results), [data.results]);
  const refined = useMemo(() => applyRefine(data.results, refine), [data.results, refine]);
  const visible = refined.slice(0, pages * PAGE);
  const nActive = activeCount(refine);

  const change = (next: Refine) => {
    setPages(1);
    onRefine(next);
  };

  const explain = useExplanations(data, refined.slice(0, EXPLAIN_TOP).map((r) => r.listing.id));

  const panel = (
    <FilterPanel
      results={data.results}
      refine={refine}
      onChange={change}
      domains={domains}
      intent={data.intent}
      onIntentChange={onIntentChange}
    />
  );

  return (
    <MotionConfig reducedMotion="user">
    <div className="grid items-start gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
      {/* desktop sidebar (start side = right in RTL) */}
      <aside className="bg-card sticky top-4 hidden max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-2xl border shadow-xs lg:flex">
        <PanelHeader count={nActive} onClear={() => change({ ...EMPTY_REFINE, sort: refine.sort })} />
        <div className="overflow-y-auto overscroll-contain px-4 [scrollbar-width:thin]">{panel}</div>
      </aside>

      <div className="flex min-w-0 flex-col gap-4">
        {/* toolbar */}
        <div className="bg-background/85 sticky top-0 z-30 -mx-4 flex flex-col gap-3 px-4 py-2 backdrop-blur-md lg:static lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">
              <AnimatedNumber value={refined.length} /> آگهی
              <span className="text-muted-foreground ms-1.5 text-sm font-normal">
                {nActive > 0
                  ? `از ${toFaDigits(data.total)} آگهیِ داخل بودجه`
                  : `${data.intent.nearMe && !data.intent.neighborhoods.length ? "نزدیک خودت " : ""}با بودجه‌ات جور است`}
              </span>
            </h2>
            <Button variant="outline" className="relative h-9 rounded-full lg:hidden" onClick={() => setSheetOpen(true)}>
              <SlidersHorizontal />
              فیلترها
              <AnimatePresence>
                {nActive > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={SPRING}
                    className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full text-[11px] font-bold"
                  >
                    {toFaDigits(nActive)}
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </div>
          <SortBar value={refine.sort} onChange={(sort) => change({ ...refine, sort })} />
        </div>

        <ActiveFilters refine={refine} onChange={change} />

        {refined.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center"
          >
            <FilterX className="text-muted-foreground size-10" />
            <p className="font-bold">با این فیلترها آگهی‌ای نموند</p>
            <p className="text-muted-foreground text-sm">یکی از فیلترها رو بردار یا بازه‌ها رو بازتر کن.</p>
            <Button variant="outline" onClick={() => change({ ...EMPTY_REFINE, sort: refine.sort })}>
              حذف همهٔ فیلترها
            </Button>
          </motion.div>
        ) : (
          <motion.ol layout className="grid gap-4 md:grid-cols-2">
            <AnimatePresence mode="popLayout" initial={false}>
              {visible.map((r, i) => {
                const id = r.listing.id;
                const ex = explain.byId[id];
                return (
                  <motion.li
                    key={id}
                    layout
                    initial={{ opacity: 0, scale: 0.96, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
                    transition={{ ...SPRING, delay: Math.min(i % PAGE, 8) * 0.025 }}
                  >
                    <ListingCard
                      result={r}
                      rank={i + 1}
                      explanation={ex?.text ?? r.explanation}
                      explaining={explain.pending.has(id)}
                      aiExplained={!!ex?.ai}
                      comparing={compareIds.includes(id)}
                      compareDisabled={compareIds.length >= compareMax}
                      onToggleCompare={() => onToggleCompare(id)}
                    />
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ol>
        )}

        {refined.length > visible.length && (
          <Button variant="outline" className="mx-auto h-10 rounded-full px-6" onClick={() => setPages((p) => p + 1)}>
            <ChevronDown />
            {toFaDigits(Math.min(PAGE, refined.length - visible.length))} آگهی دیگر
          </Button>
        )}
      </div>

      {/* mobile bottom sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="max-h-[88dvh] gap-0 rounded-t-3xl lg:hidden">
          <div className="bg-muted-foreground/30 mx-auto mt-2.5 h-1.5 w-12 rounded-full" />
          <SheetTitle className="sr-only">فیلترها</SheetTitle>
          <PanelHeader count={nActive} onClear={() => change({ ...EMPTY_REFINE, sort: refine.sort })} onClose={() => setSheetOpen(false)} />
          <div className="overflow-y-auto overscroll-contain px-4">{panel}</div>
          <div className="bg-popover border-t p-3">
            <Button className="h-12 w-full rounded-xl text-base" onClick={() => setSheetOpen(false)}>
              نمایش <AnimatedNumber value={refined.length} /> آگهی
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
    </MotionConfig>
  );
}

function PanelHeader({ count, onClear, onClose }: { count: number; onClear: () => void; onClose?: () => void }) {
  return (
    <div className="flex items-center gap-2 border-b px-4 py-3">
      <SlidersHorizontal className="text-primary size-4" />
      <span className="font-bold">فیلترها</span>
      <AnimatePresence>
        {count > 0 && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={SPRING}
            className="bg-primary/10 text-primary rounded-full px-2 text-xs font-bold"
          >
            {toFaDigits(count)}
          </motion.span>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {count > 0 && (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClear}
            className="text-muted-foreground hover:text-destructive ms-auto text-xs transition-colors"
          >
            پاک کردن همه
          </motion.button>
        )}
      </AnimatePresence>
      {onClose && (
        <button type="button" onClick={onClose} className={cn("text-muted-foreground p-1", count === 0 && "ms-auto")} aria-label="بستن">
          <X className="size-5" />
        </button>
      )}
    </div>
  );
}

function SortBar({ value, onChange }: { value: SortKey; onChange: (s: SortKey) => void }) {
  return (
    <LayoutGroup id="sort">
      <div className="-mx-4 flex items-center gap-1 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:px-0">
        <span className="text-muted-foreground me-1 shrink-0 text-xs">مرتب‌سازی:</span>
        {(Object.keys(SORTS) as SortKey[]).map((k) => {
          const on = k === value;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onChange(k)}
              aria-pressed={on}
              className={cn(
                "relative shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                on ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {on && <motion.span layoutId="sort-pill" transition={SPRING} className="bg-primary absolute inset-0 rounded-full shadow-sm" />}
              <span className="relative">{SORTS[k]}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

/** Removable summary of the hand-set filters (separate from the AI chips above). */
function ActiveFilters({ refine, onChange }: { refine: Refine; onChange: (r: Refine) => void }) {
  const chips: { id: string; label: string; next: Refine }[] = [];
  const range = (r: [number, number], f: (v: number) => string) => `${f(r[0])} تا ${f(r[1])}`;
  if (refine.price) chips.push({ id: "price", label: `رهن کامل ${range(refine.price, formatToman)}`, next: { ...refine, price: null } });
  if (refine.area) chips.push({ id: "area", label: `${range(refine.area, toFaDigits)} متر`, next: { ...refine, area: null } });
  if (refine.ppm) chips.push({ id: "ppm", label: `هر متر ${range(refine.ppm, formatToman)}`, next: { ...refine, ppm: null } });
  for (const n of refine.neighborhoods)
    chips.push({ id: `n-${n}`, label: n, next: { ...refine, neighborhoods: refine.neighborhoods.filter((x) => x !== n) } });
  for (const r of refine.rooms)
    chips.push({ id: `r-${r}`, label: r === 0 ? "سوئیت" : r === 4 ? "۴ خواب و بیشتر" : `${toFaDigits(r)} خواب`, next: { ...refine, rooms: refine.rooms.filter((x) => x !== r) } });
  for (const a of refine.amenities)
    chips.push({ id: `a-${a}`, label: AMENITIES[a].label, next: { ...refine, amenities: refine.amenities.filter((x) => x !== a) } });
  if (refine.maxAge !== null)
    chips.push({ id: "age", label: refine.maxAge === 0 ? "کلیدنخورده" : `تا ${toFaDigits(refine.maxAge)} سال ساخت`, next: { ...refine, maxAge: null } });
  for (const s of refine.sources)
    chips.push({ id: `s-${s}`, label: s === "divar" ? "فقط دیوار" : "فقط شیپور", next: { ...refine, sources: refine.sources.filter((x) => x !== s) } });

  return (
    <AnimatePresence initial={false}>
      {chips.length > 0 && (
        <motion.ul
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="-mt-1 flex flex-wrap gap-1.5 overflow-hidden"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {chips.map((c) => (
              <motion.li
                key={c.id}
                layout
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={SPRING}
              >
                <button
                  type="button"
                  onClick={() => onChange(c.next)}
                  className="bg-foreground text-background hover:bg-foreground/85 inline-flex h-7 items-center gap-1 rounded-full ps-3 pe-1.5 text-xs font-medium transition-colors"
                  aria-label={`حذف فیلتر ${c.label}`}
                >
                  {c.label}
                  <X className="size-3.5 opacity-70" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </AnimatePresence>
  );
}

/**
 * AI explanations for whatever is in the (refined) top 10: when filters or sorting bring new
 * listings to the top, only the missing ones are requested, after a short debounce.
 */
function useExplanations(data: SearchApiResponse, topIds: string[]) {
  const [byId, setById] = useState<Record<string, Explained>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());
  const inFlight = useRef(new Set<string>());
  const key = topIds.join(",");

  useEffect(() => {
    const missing = key ? key.split(",").filter((id) => !(id in byId) && !inFlight.current.has(id)) : [];
    if (!missing.length) return;
    // only the debounce is cancelled; a request already sent always lands (the view remounts per search)
    const t = setTimeout(async () => {
      missing.forEach((id) => inFlight.current.add(id));
      setPending((p) => new Set([...p, ...missing]));
      const ex = await fetch("/api/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: data.query, intent: data.intent, ids: missing }),
      })
        .then((r) => (r.ok ? (r.json() as Promise<ExplainApiResponse>) : null))
        .catch(() => null);
      missing.forEach((id) => inFlight.current.delete(id));
      setPending((p) => new Set([...p].filter((id) => !missing.includes(id))));
      setById((prev) => {
        const next = { ...prev };
        for (const id of missing) next[id] = { text: ex?.byId[id] ?? null, ai: ex?.source === "ai" && !!ex.byId[id] };
        return next;
      });
    }, 250);
    return () => clearTimeout(t);
  }, [key, byId, data.query, data.intent]);

  return { byId, pending };
}

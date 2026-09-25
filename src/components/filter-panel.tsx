"use client";

import { DirectionProvider } from "@base-ui/react/direction-provider";
import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import {
  ArrowLeftRight,
  ArrowUpDown,
  BedDouble,
  Car,
  Check,
  ChevronDown,
  ConciergeBell,
  Fence,
  Hourglass,
  MapPin,
  Package,
  Ruler,
  Sofa,
  Sparkles,
  Store,
  TramFront,
  Trees,
  Wallet,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, LayoutGroup, motion, useSpring, useTransform } from "motion/react";
import { useEffect, useId, useMemo, useState } from "react";

import { AMENITIES, type AmenityKey } from "@/lib/amenities";
import type { SearchIntent, SearchResult } from "@/lib/api-types";
import { formatToman, toFaDigits } from "@/lib/persian";
import {
  AGE_OPTIONS,
  facets,
  FILTER_AMENITIES,
  histogram,
  RANGE_STEPS,
  RANGE_VALUE,
  ROOM_OPTIONS,
  toMonthly,
  withoutFilter,
  type Facets,
  type MaxAge,
  type Range,
  type RangeKey,
  type Refine,
} from "@/lib/search/refine";
import { NEIGHBORHOODS, type ListingSource } from "@/lib/types";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring", stiffness: 420, damping: 34 } as const;

const AMENITY_ICONS: Record<AmenityKey, LucideIcon> = {
  parking: Car,
  elevator: ArrowUpDown,
  storage: Package,
  balcony: Fence,
  furnished: Sofa,
  newBuilding: Sparkles,
  nearMetro: TramFront,
  yard: Trees,
  lobby: ConciergeBell,
  pool: Waves,
  convertible: ArrowLeftRight,
};

const AGE_LABEL = (a: MaxAge) => (a === null ? "همه" : a === 0 ? "کلیدنخورده" : `${toFaDigits(a)} سال`);
const ROOM_LABEL = (r: number) => (r === 0 ? "سوئیت" : r === 4 ? "۴+" : toFaDigits(r));
const SOURCES: { key: ListingSource; label: string; dot: string }[] = [
  { key: "divar", label: "دیوار", dot: "bg-rose-500" },
  { key: "sheypoor", label: "شیپور", dot: "bg-indigo-500" },
];

const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

export interface FilterPanelProps {
  results: SearchResult[];
  refine: Refine;
  onChange: (next: Refine) => void;
  domains: Record<RangeKey, Range>;
  intent: SearchIntent;
  onIntentChange: (next: SearchIntent) => void;
  className?: string;
}

/** Faceted filters over the AI-ranked results: live counts, histograms, instant apply. */
export function FilterPanel({ results, refine, onChange, domains, intent, onIntentChange, className }: FilterPanelProps) {
  const group = useId();
  const fc: Facets = useMemo(() => facets(results, refine), [results, refine]);
  const set = <K extends keyof Refine>(key: K, value: Refine[K]) => onChange({ ...refine, [key]: value });
  const [unit, setUnit] = useState<"deposit" | "rent">("deposit");
  const hasBudget = intent.maxDeposit !== null || intent.maxRent !== null;

  const priceFmt = (v: number) => formatToman(unit === "rent" ? toMonthly(v) : v);

  return (
    <LayoutGroup id={group}>
      <div className={cn("flex flex-col", className)}>
        <Section title="قیمت" hint={unit === "rent" ? "(اجارهٔ ماهانه، بدون رهن)" : "(معادل رهن کامل)"} icon={Wallet} active={!!refine.price} onClear={() => set("price", null)}>
          <Segmented
            layoutId="unit"
            value={unit}
            onChange={setUnit}
            options={[
              { value: "deposit", label: "رهن کامل" },
              { value: "rent", label: "اجارهٔ کامل" },
            ]}
          />
          <RangeFilter k="price" results={results} refine={refine} domain={domains.price} onChange={(r) => set("price", r)} format={priceFmt} />
          {hasBudget && (
            <p className="bg-brand-soft text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-2.5 py-2 text-xs leading-5">
              <Sparkles className="text-primary size-3.5 shrink-0" />
              فقط آگهی‌های داخل بودجه‌ات نشون داده می‌شن.
              <button
                type="button"
                onClick={() => onIntentChange({ ...intent, maxDeposit: null, maxRent: null, flexibleConversion: true })}
                className="text-primary font-bold underline-offset-4 hover:underline"
              >
                برداشتن سقف بودجه
              </button>
            </p>
          )}
        </Section>

        <Section title="محله" icon={MapPin} active={refine.neighborhoods.length > 0} onClear={() => set("neighborhoods", [])}>
          <div className="flex flex-wrap gap-1.5">
            {NEIGHBORHOODS.map((n) => (
              <ToggleChip
                key={n}
                label={n}
                count={fc.neighborhoods[n]}
                selected={refine.neighborhoods.includes(n)}
                onClick={() => set("neighborhoods", toggle(refine.neighborhoods, n))}
              />
            ))}
          </div>
        </Section>

        <Section title="تعداد خواب" icon={BedDouble} active={refine.rooms.length > 0} onClear={() => set("rooms", [])}>
          <div className="grid grid-cols-5 gap-1.5">
            {ROOM_OPTIONS.map((r) => {
              const on = refine.rooms.includes(r);
              const n = fc.rooms[r];
              return (
                <motion.button
                  key={r}
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  disabled={!on && n === 0}
                  onClick={() => set("rooms", toggle(refine.rooms, r))}
                  aria-pressed={on}
                  className={cn(
                    "flex h-12 flex-col items-center justify-center rounded-xl border text-sm font-bold transition-colors disabled:opacity-35",
                    on ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-background hover:border-primary/50",
                  )}
                >
                  {ROOM_LABEL(r)}
                  <span className={cn("text-[10px] font-medium", on ? "opacity-80" : "text-muted-foreground")}>{toFaDigits(n)}</span>
                </motion.button>
              );
            })}
          </div>
        </Section>

        <Section title="متراژ" hint="(متر)" icon={Ruler} active={!!refine.area} onClear={() => set("area", null)}>
          <RangeFilter k="area" results={results} refine={refine} domain={domains.area} onChange={(r) => set("area", r)} format={(v) => `${toFaDigits(v)} متر`} />
        </Section>

        <Section title="قیمت هر متر" hint="(معادل رهن کامل)" icon={Wallet} active={!!refine.ppm} onClear={() => set("ppm", null)} defaultOpen={false}>
          <RangeFilter k="ppm" results={results} refine={refine} domain={domains.ppm} onChange={(r) => set("ppm", r)} format={formatToman} />
        </Section>

        <Section title="امکانات" icon={Sparkles} active={refine.amenities.length > 0} onClear={() => set("amenities", [])}>
          <div className="flex flex-wrap gap-1.5">
            {FILTER_AMENITIES.map((k) => (
              <ToggleChip
                key={k}
                icon={AMENITY_ICONS[k]}
                label={AMENITIES[k].label}
                count={fc.amenities[k]}
                selected={refine.amenities.includes(k)}
                onClick={() => set("amenities", toggle(refine.amenities, k))}
              />
            ))}
          </div>
        </Section>

        <Section title="سن بنا" hint="(حداکثر)" icon={Hourglass} active={refine.maxAge !== null} onClear={() => set("maxAge", null)}>
          <Segmented
            layoutId="age"
            value={String(refine.maxAge)}
            onChange={(v) => set("maxAge", v === "null" ? null : (Number(v) as MaxAge))}
            options={AGE_OPTIONS.map((a) => ({ value: String(a), label: AGE_LABEL(a), count: fc.maxAge[String(a)] }))}
          />
        </Section>

        <Section title="منبع آگهی" icon={Store} active={refine.sources.length > 0} onClear={() => set("sources", [])} last>
          <div className="flex flex-wrap gap-1.5">
            {SOURCES.map((s) => (
              <ToggleChip
                key={s.key}
                dot={s.dot}
                label={s.label}
                count={fc.sources[s.key]}
                selected={refine.sources.includes(s.key)}
                onClick={() => set("sources", toggle(refine.sources, s.key))}
              />
            ))}
          </div>
        </Section>
      </div>
    </LayoutGroup>
  );
}

// ---------- building blocks ----------

function Section({
  title,
  hint,
  icon: Icon,
  active,
  onClear,
  defaultOpen = true,
  last,
  children,
}: {
  title: string;
  hint?: string;
  icon: LucideIcon;
  active: boolean;
  onClear: () => void;
  defaultOpen?: boolean;
  last?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={cn("py-4", !last && "border-b")}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className="group flex flex-1 items-center gap-2 text-start" aria-expanded={open}>
          <Icon className="text-muted-foreground group-hover:text-primary size-4 transition-colors" />
          <span className="text-sm font-bold">{title}</span>
          {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
          <AnimatePresence>
            {active && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={SPRING}
                className="bg-primary size-2 rounded-full"
              />
            )}
          </AnimatePresence>
        </button>
        <AnimatePresence>
          {active && (
            <motion.button
              type="button"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              onClick={onClear}
              className="text-primary text-xs font-medium hover:underline"
            >
              حذف
            </motion.button>
          )}
        </AnimatePresence>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-label={open ? "بستن" : "باز کردن"} className="text-muted-foreground p-1">
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={SPRING} className="block">
            <ChevronDown className="size-4" />
          </motion.span>
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function ToggleChip({
  label,
  count,
  selected,
  onClick,
  icon: Icon,
  dot,
}: {
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
  icon?: LucideIcon;
  dot?: string;
}) {
  const disabled = !selected && count === 0;
  return (
    <motion.button
      type="button"
      layout
      whileTap={{ scale: 0.94 }}
      transition={SPRING}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors disabled:opacity-35",
        selected ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-background hover:border-primary/50 hover:text-primary",
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {selected ? (
          <motion.span key="check" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={SPRING}>
            <Check className="size-3.5" strokeWidth={3} />
          </motion.span>
        ) : Icon ? (
          <motion.span key="icon" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={SPRING}>
            <Icon className="size-3.5" />
          </motion.span>
        ) : dot ? (
          <motion.span key="dot" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className={cn("size-2 rounded-full", dot)} />
        ) : null}
      </AnimatePresence>
      {label}
      <span className={cn("rounded-full px-1.5 text-[10px] tabular-nums", selected ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground")}>
        {toFaDigits(count)}
      </span>
    </motion.button>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  layoutId,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
  layoutId: string;
}) {
  return (
    <div
      className="bg-muted grid gap-0.5 rounded-xl p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      role="radiogroup"
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            disabled={!on && o.count === 0}
            className={cn(
              "relative rounded-lg px-1 py-1.5 text-xs font-medium whitespace-nowrap transition-colors disabled:opacity-35",
              on ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {on && <motion.span layoutId={layoutId} transition={SPRING} className="bg-background absolute inset-0 rounded-lg shadow-sm" />}
            <span className="relative flex flex-col items-center">
              <span className={cn(o.count !== undefined && "text-[11px] tracking-tight")}>{o.label}</span>
              {o.count !== undefined && <span className="text-muted-foreground text-[10px]">{toFaDigits(o.count)}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const BINS = 28;

function RangeFilter({
  k,
  results,
  refine,
  domain,
  onChange,
  format,
}: {
  k: RangeKey;
  results: SearchResult[];
  refine: Refine;
  domain: Range;
  onChange: (r: Range | null) => void;
  format: (v: number) => string;
}) {
  const committed = refine[k] ?? domain;
  // local value while dragging; the list only re-filters on release (smooth list animation)
  const [draft, setDraft] = useState<Range | null>(null);
  const value = draft ?? committed;

  const base = useMemo(() => withoutFilter(results, refine, k).map(RANGE_VALUE[k]), [results, refine, k]);
  const bars = useMemo(() => histogram(base, domain, BINS), [base, domain]);
  const peak = Math.max(1, ...bars);
  const binW = (domain[1] - domain[0]) / BINS;
  const inside = base.filter((v) => v >= value[0] && v <= value[1]).length;

  return (
    <div className="flex flex-col gap-2">
      {/* histogram: first bar = cheapest, on the right (RTL) like the slider */}
      <div className="flex h-14 items-end gap-px px-1.5" aria-hidden>
        {bars.map((n, i) => {
          const lo = domain[0] + i * binW;
          const on = lo + binW > value[0] && lo < value[1];
          return (
            <motion.div
              key={i}
              className={cn("flex-1 rounded-t-[3px] transition-colors duration-200", on ? "bg-primary/70" : "bg-muted-foreground/20")}
              initial={false}
              animate={{ height: n === 0 ? 2 : `${Math.max(8, (n / peak) * 100)}%` }}
              transition={{ ...SPRING, delay: i * 0.008 }}
            />
          );
        })}
      </div>
      <DirectionProvider direction="rtl">
        <SliderPrimitive.Root
          value={value}
          min={domain[0]}
          max={domain[1]}
          step={RANGE_STEPS[k].step}
          minStepsBetweenValues={1}
          onValueChange={(v) => setDraft(v as Range)}
          onValueCommitted={(v) => {
            setDraft(null);
            const [lo, hi] = v as Range;
            onChange(lo <= domain[0] && hi >= domain[1] ? null : [lo, hi]);
          }}
          className="-mt-2 w-full"
        >
          <SliderPrimitive.Control className="relative flex h-6 w-full touch-none items-center select-none">
            <SliderPrimitive.Track className="bg-muted relative h-1.5 w-full rounded-full">
              <SliderPrimitive.Indicator className="bg-primary rounded-full" />
            </SliderPrimitive.Track>
            {[0, 1].map((i) => (
              <SliderPrimitive.Thumb
                key={i}
                index={i}
                aria-label={i === 0 ? "از" : "تا"}
                className="border-primary bg-background ring-primary/20 block size-5 rounded-full border-2 shadow-md transition-[box-shadow,scale] outline-none hover:ring-6 focus-visible:ring-6 active:scale-110"
              />
            ))}
          </SliderPrimitive.Control>
        </SliderPrimitive.Root>
      </DirectionProvider>
      <div className="flex items-center gap-2">
        <Readout label="از" value={format(value[0])} />
        <span className="bg-border h-px w-3 shrink-0" />
        <Readout label="تا" value={format(value[1])} />
      </div>
      <p className="text-muted-foreground text-[11px]">
        <AnimatedNumber value={inside} /> آگهی در این بازه
      </p>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background flex min-w-0 flex-1 items-baseline gap-1.5 rounded-lg border px-2.5 py-1.5">
      <span className="text-muted-foreground text-[11px]">{label}</span>
      <motion.span key={value} initial={{ opacity: 0.4, y: 3 }} animate={{ opacity: 1, y: 0 }} className="truncate text-sm font-bold tabular-nums">
        {value}
      </motion.span>
    </div>
  );
}

/** Springy counter in Persian digits. */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const spring = useSpring(value, { stiffness: 260, damping: 30 });
  const text = useTransform(spring, (v) => toFaDigits(Math.round(v)));
  useEffect(() => {
    spring.set(value);
  }, [spring, value]);
  return <motion.span className={cn("tabular-nums", className)}>{text}</motion.span>;
}

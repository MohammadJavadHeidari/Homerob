"use client";

import { useState } from "react";

import { formatFaNumber, toFaDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

const DAY_FMT = new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "long" });
const DAY_NUM_FMT = new Intl.DateTimeFormat("fa-IR", { day: "numeric" });

/** Clean y-axis max: 1, 2, 5 × 10^n at or above the data max (at least 4 so an empty chart still has an axis). */
function niceMax(v: number) {
  const m = Math.max(4, v);
  const p = 10 ** Math.floor(Math.log10(m));
  return [1, 2, 5, 10].map((k) => k * p).find((x) => x >= m)!;
}

/**
 * Daily views, one series → no legend (the title names it). Columns ≤ 24px with a 4px rounded top and a square
 * base, hairline solid gridlines, today in the brand color (emphasis), earlier days in slate. Hover/focus a day →
 * tooltip with views and contacts. RTL: time runs right → left like the rest of the page.
 */
export function ViewsChart({ days, views, contacts }: { days: number[]; views: number[]; contacts: number[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...views));
  const ticks = [0, max / 2, max];
  const H = 180;
  const n = days.length;

  return (
    <figure className="flex flex-col gap-2">
      <div className="relative flex gap-2" style={{ height: H + 24 }}>
        {/* y ticks */}
        <div className="text-muted-foreground relative w-6 shrink-0 text-[11px] tabular-nums" style={{ height: H }}>
          {ticks.map((t) => (
            <span key={t} className="absolute end-0 -translate-y-1/2" style={{ top: H - (t / max) * H }}>
              {toFaDigits(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1" onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <div key={t} className="bg-border absolute inset-x-0 h-px" style={{ top: H - (t / max) * H }} />
          ))}
          <div className="absolute inset-x-0 top-0 grid" style={{ height: H, gridTemplateColumns: `repeat(${n}, 1fr)` }}>
            {views.map((v, i) => {
              const today = i === n - 1;
              const h = (v / max) * H;
              return (
                <button
                  key={days[i]}
                  type="button"
                  aria-label={`${DAY_FMT.format(days[i])}: ${toFaDigits(v)} بازدید، ${toFaDigits(contacts[i])} تماس`}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="group relative flex h-full items-end justify-center outline-none"
                >
                  <span className={cn("absolute inset-x-0.5 inset-y-0 rounded-md transition-colors", hover === i && "bg-muted")} />
                  <span
                    className={cn(
                      "relative w-full max-w-6 rounded-t-[4px] transition-[height] duration-500 ease-out",
                      today ? "bg-primary" : "bg-slate-400 dark:bg-slate-500",
                      v === 0 && "opacity-0",
                    )}
                    style={{ height: Math.max(v ? 3 : 0, h) }}
                  />
                </button>
              );
            })}
          </div>
          {/* x labels: every other day + today */}
          <div className="text-muted-foreground absolute inset-x-0 grid text-[11px]" style={{ top: H + 6, gridTemplateColumns: `repeat(${n}, 1fr)` }}>
            {days.map((d, i) => (
              <span key={d} className="truncate text-center">
                {i === n - 1 ? "امروز" : (n - 1 - i) % 2 === 0 ? DAY_NUM_FMT.format(d) : ""}
              </span>
            ))}
          </div>
          {hover !== null && (
            <div
              className="bg-popover text-popover-foreground pointer-events-none absolute z-10 flex min-w-32 -translate-x-1/2 flex-col gap-1 rounded-lg px-3 py-2 text-xs shadow-[0_8px_24px_-8px_rgb(15_23_43/0.3)] ring-1 ring-foreground/10"
              style={{ left: `${((n - 1 - hover + 0.5) / n) * 100}%`, top: Math.max(0, H - (views[hover] / max) * H - 64) }}
            >
              <span className="text-muted-foreground">{DAY_FMT.format(days[hover])}</span>
              <span className="flex items-center gap-1.5">
                <span className={cn("size-2 rounded-sm", hover === n - 1 ? "bg-primary" : "bg-slate-400")} />
                <b>{toFaDigits(views[hover])}</b> بازدید
              </span>
              <span className="text-muted-foreground">{toFaDigits(contacts[hover])} تماس</span>
            </div>
          )}
        </div>
      </div>
    </figure>
  );
}

/** 14-day views sparkline for a table row: 2px line, today's dot in the brand color. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const W = 84;
  const H = 24;
  const max = Math.max(1, ...values);
  // RTL: today on the left end, like the big chart
  const x = (i: number) => W - 2 - (i / (values.length - 1)) * (W - 4);
  const y = (v: number) => H - 3 - (v / max) * (H - 6);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const last = values.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className={cn("overflow-visible", className)} aria-hidden>
      <path d={d} fill="none" className="stroke-slate-400" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(values[last])} r={3.5} className="fill-primary stroke-card" strokeWidth={2} />
    </svg>
  );
}

/** KPI tile: label, value, optional delta vs the previous 7 days and a sub line. */
export function StatTile({
  label,
  value,
  delta,
  sub,
  className,
}: {
  label: string;
  value: number | string;
  delta?: { text: string; up: boolean } | null;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={cn("bg-card flex flex-col gap-1.5 rounded-2xl p-4 sm:rounded-lg", className)}>
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">{typeof value === "number" ? formatFaNumber(value) : value}</span>
        {delta && (
          <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-bold", delta.up ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
            {delta.text}
          </span>
        )}
      </span>
      {sub && <span className="text-muted-foreground text-xs">{sub}</span>}
    </div>
  );
}

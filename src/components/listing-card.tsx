"use client";

import {
  ArrowUpDown,
  BedDouble,
  Building2,
  CalendarClock,
  Car,
  Check,
  Clock,
  MapPin,
  Package,
  Ruler,
  Sparkles,
  X,
} from "lucide-react";

import type { SearchResult } from "@/lib/api-types";
import { ageFa, roomsFa, timeAgoFa } from "@/lib/format";
import { formatToman, toFaDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

const SOURCE_LABEL = { divar: "دیوار", sheypoor: "شیپور" } as const;

export function ListingCard({
  result,
  explanation,
  explaining,
  aiExplained,
  rank,
}: {
  result: SearchResult;
  explanation: string;
  explaining: boolean;
  aiExplained: boolean;
  rank: number;
}) {
  const { listing: l, budget, fullDeposit, score, alsoOn, highlights } = result;
  const cons = highlights.filter((h) => h.kind === "con").slice(0, 2);
  const pros = highlights.filter((h) => h.kind === "pro").slice(0, 2);

  return (
    <article className="bg-card text-card-foreground flex flex-col gap-4 rounded-2xl border p-4 shadow-xs sm:p-5">
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground font-medium">#{toFaDigits(rank)}</span>
            <SourceBadge source={l.source} />
            {alsoOn.map((s) => (
              <span key={s} className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5">
                در {SOURCE_LABEL[s]} هم هست
              </span>
            ))}
            <span className="text-muted-foreground ms-1 flex items-center gap-1">
              <Clock className="size-3" />
              {timeAgoFa(l.postedAt)}
            </span>
          </div>
          <h3 className="text-base leading-7 font-bold">{l.title}</h3>
          <p className="text-muted-foreground flex items-center gap-1 text-sm">
            <MapPin className="size-3.5 shrink-0" />
            {l.neighborhood}، {l.street}
          </p>
        </div>
        <ScoreBadge score={score} />
      </div>

      {/* price */}
      <div className="bg-muted/50 grid grid-cols-2 gap-3 rounded-xl p-3">
        <Price label="رهن" value={l.deposit} />
        <Price label="اجاره ماهانه" value={l.monthlyRent} zero="رهن کامل" />
        <p className="text-muted-foreground col-span-2 text-xs">
          معادل رهن کامل: <span className="text-foreground font-medium">{formatToman(fullDeposit)}</span>
          <span className="bg-border mx-2 inline-block h-3 w-px align-middle" />
          هر متر {formatToman(Math.round(fullDeposit / l.areaM2))}
        </p>
        {budget.converted && (
          <p className="bg-primary/10 text-primary col-span-2 rounded-lg px-2.5 py-1.5 text-xs font-medium">
            با بودجهٔ تو: رهن {formatToman(Math.round(budget.deposit / 1e6) * 1e6)}
            {budget.monthlyRent > 0
              ? ` + اجاره ${formatToman(Math.round(budget.monthlyRent / 5e5) * 5e5)}`
              : " (رهن کامل)"}
          </p>
        )}
      </div>

      {/* features */}
      <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <Feature icon={BedDouble}>{roomsFa(l.rooms)}</Feature>
        <Feature icon={Ruler}>{toFaDigits(l.areaM2)} متر</Feature>
        <Feature icon={Building2}>
          {l.floor === 0 ? "همکف" : `طبقه ${toFaDigits(l.floor)}`} از {toFaDigits(l.totalFloors)}
        </Feature>
        <Feature icon={CalendarClock}>{ageFa(l.buildingAge)}</Feature>
      </ul>
      <ul className="flex flex-wrap gap-1.5 text-xs">
        <Amenity ok={l.parking} icon={Car} label="پارکینگ" />
        <Amenity ok={l.elevator} icon={ArrowUpDown} label="آسانسور" />
        <Amenity ok={l.storage} icon={Package} label="انباری" />
        {l.tags
          .filter((t) => !["نوساز"].includes(t))
          .slice(0, 3)
          .map((t) => (
            <li key={t} className="bg-muted text-muted-foreground rounded-md px-2 py-1">
              {t}
            </li>
          ))}
      </ul>

      {/* AI explanation */}
      <div
        className={cn(
          "border-primary/20 bg-brand-soft relative rounded-xl border p-3 transition-colors",
          explaining && "animate-pulse",
        )}
      >
        <p className="text-primary mb-1 flex items-center gap-1.5 text-xs font-bold">
          <Sparkles className="size-3.5" />
          {explaining ? "هومراب داره توضیح می‌نویسه…" : "چرا این آگهی؟"}
          {aiExplained && !explaining && (
            <span className="bg-primary/15 ms-auto rounded px-1.5 py-px text-[10px] font-bold">AI</span>
          )}
        </p>
        <p className={cn("text-sm leading-7", explaining && "text-muted-foreground")}>{explanation}</p>
        {(pros.length > 0 || cons.length > 0) && (
          <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {pros.map((h) => (
              <li key={h.text} className="text-success bg-success/10 rounded-md px-2 py-0.5">
                + {h.text}
              </li>
            ))}
            {cons.map((h) => (
              <li key={h.text} className="text-warning bg-warning/10 rounded-md px-2 py-0.5">
                − {h.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

function SourceBadge({ source }: { source: SearchResult["listing"]["source"] }) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 font-bold",
        source === "divar" ? "bg-rose-500/10 text-rose-700 dark:text-rose-300" : "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
      )}
    >
      {SOURCE_LABEL[source]}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 85 ? "text-success border-success/30 bg-success/10" : score >= 65 ? "text-warning border-warning/30 bg-warning/10" : "text-muted-foreground border-border bg-muted";
  return (
    <div className={cn("flex shrink-0 flex-col items-center rounded-xl border px-2.5 py-1.5", tone)}>
      <span className="text-lg leading-none font-extrabold">{toFaDigits(score)}٪</span>
      <span className="mt-0.5 text-[10px] font-medium">تطابق</span>
    </div>
  );
}

function Price({ label, value, zero }: { label: string; value: number; zero?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-base font-bold">{value === 0 && zero ? zero : `${formatToman(value)} تومان`}</span>
    </div>
  );
}

function Feature({ icon: Icon, children }: { icon: typeof Ruler; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <Icon className="size-4 shrink-0" />
      {children}
    </li>
  );
}

function Amenity({ ok, icon: Icon, label }: { ok: boolean; icon: typeof Ruler; label: string }) {
  return (
    <li
      className={cn(
        "flex items-center gap-1 rounded-md px-2 py-1",
        ok ? "bg-success/10 text-success" : "bg-muted text-muted-foreground line-through decoration-1",
      )}
    >
      <Icon className="size-3.5" />
      {label}
      {ok ? <Check className="size-3" /> : <X className="size-3" />}
    </li>
  );
}

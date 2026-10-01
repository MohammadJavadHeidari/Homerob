"use client";

import {
  ArrowUpDown,
  BedDouble,
  Building2,
  CalendarClock,
  Car,
  Check,
  ChevronDown,
  Clock,
  GitCompareArrows,
  MapPin,
  MapPinned,
  Package,
  Ruler,
  Sparkles,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { ListingPhoto } from "@/components/listing-photo";
import { NearbyAdvantages } from "@/components/nearby-advantages";
import { PhotoPlaceholder } from "@/components/photo-placeholder";
import { NewBadge } from "@/components/new-badge";
import { SaveButton } from "@/components/save-button";
import { isPostedId } from "@/lib/account/ads";
import type { SearchResult } from "@/lib/api-types";
import { CATEGORIES, categoryOf, PRICE_LABEL } from "@/lib/categories";
import { ageFa, floorFa, roomsFa, timeAgoFa } from "@/lib/format";
import { formatToman, toFaDigits } from "@/lib/persian";
import { photoSources } from "@/lib/photo";
import { isSharedHousing } from "@/lib/quality";
import { cn } from "@/lib/utils";

export function ListingCard({
  result,
  explanation,
  explaining,
  aiExplained,
  rank,
  comparing,
  compareDisabled,
  onToggleCompare,
  selected = false,
}: {
  result: SearchResult;
  explanation: string;
  explaining: boolean;
  aiExplained: boolean;
  /** Position in the results; omitted outside a ranked list (the home rails' detail sheet). */
  rank?: number;
  comparing?: boolean;
  compareDisabled?: boolean;
  onToggleCompare?: () => void;
  /** Picked on the map: the neighborhood advantages open by themselves. */
  selected?: boolean;
}) {
  const [nearbyOpen, setNearbyOpen] = useState(false);
  const showNearby = nearbyOpen || selected;
  const { listing: l, budget, price, score, highlights } = result;
  const category = CATEGORIES[categoryOf(l)];
  const model = category.priceModel;
  const cons = highlights.filter((h) => h.kind === "con").slice(0, 2);
  const pros = highlights.filter((h) => h.kind === "pro").slice(0, 2);
  // posted on Torob from this device: not in the server data, so no nearby places for it yet
  const posted = isPostedId(l.id);

  return (
    <article className="bg-card text-card-foreground flex flex-col gap-4 rounded-2xl p-4 sm:rounded-lg sm:p-5">
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        {/* the ad's photo (our copy, then Divar's CDN) over a calm placeholder */}
        <Link href={`/ads/${l.id}`} tabIndex={-1} aria-hidden className="relative size-20 shrink-0 overflow-hidden rounded-lg sm:size-24">
          <PhotoPlaceholder listing={l} />
          <ListingPhoto sources={photoSources(l)} className="absolute inset-0 size-full object-cover" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {rank !== undefined && <span className="text-muted-foreground font-medium">#{toFaDigits(rank)}</span>}
            {result.isNew && <NewBadge />}
            {posted && <span className="bg-secondary border-input rounded-md border px-1.5 py-0.5 font-bold">ثبت‌شده در ترب</span>}
            {isSharedHousing(l) && categoryOf(l) === "residential-rent" && (
              <span className="rounded-md bg-warning/10 px-1.5 py-0.5 font-bold text-warning">همخونه</span>
            )}
            <span className="text-muted-foreground ms-1 flex items-center gap-1">
              <Clock className="size-3" />
              {timeAgoFa(l.postedAt)}
            </span>
          </div>
          <h3 className="text-base leading-7 font-bold">
            <Link href={`/ads/${l.id}`} className="underline-offset-4 hover:underline">
              {l.title}
            </Link>
          </h3>
          <p className="text-muted-foreground flex items-center gap-1 text-sm">
            <MapPin className="size-3.5 shrink-0" />
            {l.street ? `${l.neighborhood}، ${l.street}` : l.neighborhood}
            <span className="bg-border mx-1 inline-block h-3 w-px" />
            {l.city}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-2">
          <ScoreBadge score={score} />
          <SaveButton id={l.id} className="max-sm:size-10" />
          {onToggleCompare && (
            <CompareToggle on={comparing} disabled={compareDisabled} onClick={onToggleCompare} className="max-sm:hidden" />
          )}
        </div>
      </div>

      {/* price */}
      <div className="bg-muted/50 grid grid-cols-2 gap-3 rounded-xl p-3">
        {model === "rent" ? (
          <>
            <Price label="رهن" value={l.deposit} />
            <Price label="اجاره ماهانه" value={l.monthlyRent} zero="رهن کامل" />
            <p className="text-muted-foreground col-span-2 text-xs">
              معادل رهن کامل: <span className="text-foreground font-medium">{formatToman(price)}</span>
              <span className="bg-border mx-2 inline-block h-3 w-px align-middle" />
              هر متر {formatToman(Math.round(price / l.areaM2))}
            </p>
          </>
        ) : (
          <>
            <Price label={PRICE_LABEL[model].price} value={price} />
            {model === "sale" && <Price label="قیمت هر متر" value={Math.round(price / l.areaM2)} />}
          </>
        )}
        {budget.converted && (
          <p className="bg-secondary text-foreground col-span-2 rounded-lg px-2.5 py-1.5 text-xs font-medium">
            با بودجهٔ تو: رهن {formatToman(Math.round(budget.deposit / 1e6) * 1e6)}
            {budget.monthlyRent > 0
              ? ` + اجاره ${formatToman(Math.round(budget.monthlyRent / 5e5) * 5e5)}`
              : " (رهن کامل)"}
          </p>
        )}
      </div>

      {/* features */}
      <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {/* real ads often leave these out — show only what the ad states */}
        {category.residential && l.rooms !== undefined && <Feature icon={BedDouble}>{roomsFa(l.rooms)}</Feature>}
        <Feature icon={Ruler}>{toFaDigits(l.areaM2)} متر</Feature>
        {l.floor !== undefined && <Feature icon={Building2}>{floorFa(l.floor, l.totalFloors)}</Feature>}
        {l.buildingAge !== undefined && <Feature icon={CalendarClock}>{ageFa(l.buildingAge)}</Feature>}
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
          "bg-secondary relative rounded-lg border p-3 transition-colors",
          explaining && "animate-pulse",
        )}
      >
        <p className="text-foreground mb-1 flex items-center gap-1.5 text-xs font-bold">
          <Sparkles className="text-primary size-3.5" />
          {explaining ? "ترب داره توضیح می‌نویسه…" : "چرا این آگهی؟"}
          {aiExplained && !explaining && (
            <span className="bg-brand-soft text-brand-ink ms-auto rounded px-1.5 py-px text-[10px] font-bold">AI</span>
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

      {/* neighborhood advantages (lazy: one AI call per opened listing) */}
      {(!posted || onToggleCompare) && (
      <div className="-mt-1 flex items-start gap-2">
      {!posted && (
        <div className="min-w-0 flex-1 rounded-xl border border-dashed">
          <button
            type="button"
            onClick={() => setNearbyOpen(!showNearby)}
            aria-expanded={showNearby}
            className="hover:text-primary flex min-h-11 w-full items-center gap-2 px-3 py-2.5 text-start text-sm font-bold transition-colors"
          >
            <MapPinned className="text-primary size-4 shrink-0" />
            {category.residential ? "اطراف این خونه چی داره؟" : "اطراف اینجا چی داره؟"}
            <span className="text-muted-foreground hidden text-xs font-normal sm:inline">مترو، خرید، درمانگاه…</span>
            <ChevronDown className={cn("text-muted-foreground ms-auto size-4 transition-transform", showNearby && "rotate-180")} />
          </button>
          <AnimatePresence initial={false}>
            {showNearby && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3">
                  <NearbyAdvantages id={l.id} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      {/* phones: compare sits at the bottom of the card, in thumb reach and full height */}
      {onToggleCompare && (
        <CompareToggle on={comparing} disabled={compareDisabled} onClick={onToggleCompare} className="h-11 shrink-0 rounded-xl px-3 text-xs sm:hidden" />
      )}
      </div>
      )}
    </article>
  );
}

function CompareToggle({ on, disabled, onClick, className }: { on?: boolean; disabled?: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !on}
      aria-pressed={on}
      className={cn(
        "flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-[color,background-color,border-color,transform] active:scale-95 disabled:opacity-40",
        on ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:border-foreground/40 hover:text-foreground",
        className,
      )}
    >
      {on ? <Check className="size-3.5" /> : <GitCompareArrows className="size-3.5" />}
      مقایسه
    </button>
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

function Amenity({ ok, icon: Icon, label }: { ok?: boolean; icon: typeof Ruler; label: string }) {
  if (ok === undefined) return null; // the ad doesn't say
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

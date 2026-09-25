"use client";

import { MapPin, Sparkles, X, type LucideIcon } from "lucide-react";

import { AMENITIES } from "@/lib/amenities";
import type { SearchIntent } from "@/lib/api-types";
import { formatToman, toFaDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

interface Chip {
  id: string;
  label: string;
  tone: "budget" | "place" | "home" | "must" | "nice" | "note";
  icon?: LucideIcon;
  remove: (i: SearchIntent) => SearchIntent;
}

/** Turn the parsed intent into human-readable, individually removable chips. */
export function intentToChips(intent: SearchIntent): Chip[] {
  const chips: Chip[] = [];
  if (intent.maxDeposit !== null) {
    chips.push({
      id: "deposit",
      label: intent.maxRent === 0 ? `رهن کامل تا ${formatToman(intent.maxDeposit)}` : `رهن تا ${formatToman(intent.maxDeposit)}`,
      tone: "budget",
      remove: (i) => ({ ...i, maxDeposit: null, maxRent: i.maxRent === 0 ? null : i.maxRent }),
    });
  }
  if (intent.maxRent !== null && intent.maxRent > 0) {
    chips.push({ id: "rent", label: `اجاره تا ${formatToman(intent.maxRent)}`, tone: "budget", remove: (i) => ({ ...i, maxRent: null }) });
  }
  if (!intent.flexibleConversion) {
    chips.push({ id: "fixed", label: "بدون تبدیل رهن و اجاره", tone: "budget", remove: (i) => ({ ...i, flexibleConversion: true }) });
  }
  for (const n of intent.neighborhoods) {
    chips.push({
      id: `hood-${n}`,
      label: n,
      tone: "place",
      remove: (i) => ({ ...i, neighborhoods: i.neighborhoods.filter((x) => x !== n) }),
    });
  }
  if (intent.nearMe && !intent.neighborhoods.length) {
    chips.push({
      id: "near-me",
      label: `نزدیک خودت: ${intent.nearMe} و اطراف`,
      tone: "place",
      icon: MapPin,
      remove: (i) => ({ ...i, nearMe: null }),
    });
  }
  if (intent.minRooms !== null || intent.maxRooms !== null) {
    chips.push({ id: "rooms", label: roomsLabel(intent), tone: "home", remove: (i) => ({ ...i, minRooms: null, maxRooms: null }) });
  }
  if (intent.minArea !== null) {
    chips.push({ id: "area", label: `حداقل ${toFaDigits(intent.minArea)} متر`, tone: "home", remove: (i) => ({ ...i, minArea: null }) });
  }
  for (const k of intent.mustHave) {
    chips.push({
      id: `must-${k}`,
      label: AMENITIES[k].label,
      tone: "must",
      remove: (i) => ({ ...i, mustHave: i.mustHave.filter((x) => x !== k) }),
    });
  }
  for (const k of intent.niceToHave) {
    chips.push({
      id: `nice-${k}`,
      label: `${AMENITIES[k].label} (ترجیحی)`,
      tone: "nice",
      remove: (i) => ({ ...i, niceToHave: i.niceToHave.filter((x) => x !== k) }),
    });
  }
  if (intent.sharedRoom) {
    chips.push({ id: "shared", label: "اتاق در واحد اشتراکی (همخونه)", tone: "home", remove: (i) => ({ ...i, sharedRoom: false }) });
  }
  if (intent.freeTextNotes) {
    chips.push({ id: "note", label: intent.freeTextNotes, tone: "note", remove: (i) => ({ ...i, freeTextNotes: null }) });
  }
  return chips;
}

function roomsLabel({ minRooms: min, maxRooms: max }: SearchIntent) {
  const r = (n: number) => (n === 0 ? "سوئیت" : `${toFaDigits(n)} خواب`);
  if (min !== null && max !== null) return min === max ? r(min) : `${r(min)} تا ${r(max)}`;
  if (min !== null) return min === 0 ? "سوئیت یا بیشتر" : `${toFaDigits(min)} خواب یا بیشتر`;
  return `تا ${r(max!)}`;
}

const TONES: Record<Chip["tone"], string> = {
  // One brand style for everything the AI understood (docs/BRAND.md: no chip rainbow).
  budget: "bg-brand-soft text-brand-ink border-primary/20",
  place: "bg-brand-soft text-brand-ink border-primary/20",
  home: "bg-brand-soft text-brand-ink border-primary/20",
  must: "bg-brand-soft text-brand-ink border-primary/20",
  nice: "bg-muted text-muted-foreground border-border",
  note: "bg-muted text-muted-foreground border-border",
};

export function IntentChips({
  intent,
  source,
  onChange,
  disabled,
}: {
  intent: SearchIntent;
  source: "ai" | "rules" | "edited";
  onChange: (next: SearchIntent) => void;
  disabled?: boolean;
}) {
  const chips = intentToChips(intent);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
        <Sparkles className="text-primary size-4" />
        {source === "edited" ? "فیلترها رو خودت تغییر دادی:" : "ترب این‌طور فهمید:"}
      </p>
      {chips.length === 0 ? (
        <p className="text-muted-foreground text-sm">چیز خاصی مشخص نکردی — همهٔ آگهی‌ها رو نشون می‌دم.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li key={chip.id}>
              <span
                className={cn(
                  "inline-flex h-8 items-center gap-1 rounded-full border ps-3 pe-1 text-sm font-medium",
                  TONES[chip.tone],
                )}
              >
                {chip.icon && <chip.icon className="size-3.5" />}
                {chip.label}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(chip.remove(intent))}
                  className="hover:bg-foreground/10 inline-flex size-6 items-center justify-center rounded-full transition-colors disabled:opacity-50"
                  aria-label={`حذف ${chip.label}`}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

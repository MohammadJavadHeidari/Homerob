"use client";

import { Building2, CalendarDays, Construction, KeyRound, Store, House, type LucideIcon } from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import { useEffect, useRef } from "react";

import { CATEGORIES, CATEGORY_KEYS, type CategoryKey } from "@/lib/categories";
import { cn } from "@/lib/utils";

const ICONS: Record<CategoryKey, LucideIcon> = {
  "residential-rent": KeyRound,
  "residential-sale": House,
  "commercial-rent": Store,
  "commercial-sale": Building2,
  "short-term": CalendarDays,
  projects: Construction,
};

const SPRING = { type: "spring", stiffness: 380, damping: 32 } as const;

/**
 * Divar's real-estate categories as one scrollable row. Shows the category the AI understood and
 * switches it by hand (same query, re-searched in the other category).
 */
export function CategoryTabs({
  value,
  onChange,
  disabled,
}: {
  value: CategoryKey;
  onChange: (next: CategoryKey) => void;
  disabled?: boolean;
}) {
  const active = useRef<HTMLButtonElement>(null);
  // small screens: the AI may pick a category that is off-screen in the row
  useEffect(() => active.current?.scrollIntoView({ block: "nearest", inline: "nearest" }), [value]);
  return (
    <LayoutGroup id="category">
      <nav aria-label="دسته‌بندی املاک" className="-mx-4 overflow-x-auto border-b px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1.5">
          {CATEGORY_KEYS.map((k) => {
            const on = k === value;
            const Icon = ICONS[k];
            return (
              <li key={k}>
                <button
                  ref={on ? active : undefined}
                  type="button"
                  disabled={disabled}
                  onClick={() => !on && onChange(k)}
                  aria-current={on ? "true" : undefined}
                  className={cn(
                    "relative flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors disabled:opacity-60",
                    on ? "text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {on && <motion.span layoutId="category-pill" transition={SPRING} className="bg-primary absolute inset-0 rounded-full shadow-sm" />}
                  <Icon className="relative size-4" />
                  <span className="relative">{CATEGORIES[k].label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </LayoutGroup>
  );
}

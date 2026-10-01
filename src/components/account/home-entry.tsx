"use client";

import { Building2, ChevronLeft, CirclePlus, LayoutGrid } from "lucide-react";
import Link from "next/link";

import { AccountButton } from "@/components/account/site-header";
import { cn } from "@/lib/utils";

/**
 * Home top bar, torob.com's layout: links on the start side, «ورود / ثبت نام» on the end side. Sits over the dark
 * map, so it inherits the `.dark` tokens of the home container.
 */
export function HomeTopBar({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-x-0 top-0 z-20", className)}>
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-4 text-sm">
        <Link href="/ads" className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors">
          <LayoutGrid className="size-4" />
          آگهی‌ها
        </Link>
        <Link href="/agency" className="text-muted-foreground hover:text-foreground hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors sm:flex">
          <Building2 className="size-4" />
          پنل املاک
        </Link>
        <span className="flex-1" />
        <Link
          href="/new"
          className="bg-card/80 border-input hover:bg-card me-1 flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium backdrop-blur transition-colors"
        >
          <CirclePlus className="size-3.5" />
          ثبت آگهی
        </Link>
        <AccountButton className="bg-card/80 backdrop-blur" />
      </div>
    </div>
  );
}

const TOPICS = [
  {
    href: "/new",
    icon: CirclePlus,
    title: "آگهی ملکت رو رایگان ثبت کن",
    text: "با شماره موبایل وارد شو؛ آگهی‌ت جلوی کسی میاد که دنبالشه.",
  },
  {
    href: "/agency",
    icon: Building2,
    title: "مشاور املاکی؟",
    text: "فایل‌هات رو یه‌جا آپلود کن و ببین چند نفر دیدن.",
  },
] as const;

/** The two new doors on the home page: owners post an ad, agencies open their panel. */
export function HomeTopics({ className }: { className?: string }) {
  return (
    <div data-hero-block className={cn("mx-auto grid w-full max-w-2xl grid-cols-2 gap-2 sm:gap-3", className)}>
      {TOPICS.map(({ href, icon: Icon, title, text }) => (
        <Link
          key={href}
          href={href}
          className="group bg-card/75 hover:bg-card flex items-start gap-3 rounded-lg p-3 ring-1 ring-white/10 backdrop-blur transition-[background-color,transform] active:scale-[0.99] sm:p-4"
        >
          <span className="bg-primary/15 text-primary hidden size-9 shrink-0 place-items-center rounded-lg sm:grid">
            <Icon className="size-[18px]" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1 text-start">
            <span className="flex items-center gap-1 text-sm font-bold">
              {title}
              <ChevronLeft className="text-muted-foreground size-4 transition-transform group-hover:-translate-x-0.5" />
            </span>
            <span className="text-muted-foreground text-xs leading-5">{text}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

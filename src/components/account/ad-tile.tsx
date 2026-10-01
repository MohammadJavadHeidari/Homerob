import { Building2, House, ImageOff, Store, TentTree } from "lucide-react";
import Link from "next/link";

import { categoryOf, type CategoryKey } from "@/lib/categories";
import { priceLineFa, roomsFa, timeAgoFa } from "@/lib/format";
import { toFaDigits } from "@/lib/persian";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICON: Record<CategoryKey, typeof House> = {
  "residential-rent": House,
  "residential-sale": House,
  "commercial-rent": Store,
  "commercial-sale": Store,
  "short-term": TentTree,
  projects: Building2,
};

/**
 * Divar-style ad row: text on the start side, square photo on the end side. Used by «آگهی‌ها», «آگهی‌های من»
 * and the agency's file list. `badge` marks ads posted on Torob («آگهی شما» / the agency name).
 */
export function AdTile({
  listing: l,
  image,
  href,
  badge,
  footer,
  className,
}: {
  listing: Listing;
  image?: string;
  href: string;
  badge?: string;
  footer?: React.ReactNode;
  className?: string;
}) {
  const Icon = ICON[categoryOf(l)];
  // only photos posted on Torob; real ads' own thumbnails wait for the owner's go-ahead (PLAN: "Show the ad's thumbnail")
  const photo = image;
  return (
    <article className={cn("bg-card flex flex-col rounded-2xl sm:rounded-lg", className)}>
      <Link href={href} className="group flex gap-3 p-3 transition-colors sm:p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="line-clamp-2 text-sm leading-6 font-bold group-hover:underline group-hover:underline-offset-4">{l.title}</h3>
          <p className="text-muted-foreground text-xs">
            {toFaDigits(l.areaM2)} متر{l.rooms !== undefined && ` · ${roomsFa(l.rooms)}`}
          </p>
          <p className="mt-auto text-sm font-bold">{priceLineFa(l)}</p>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
            <span>
              {timeAgoFa(l.postedAt)} در {l.neighborhood}، {l.city}
            </span>
            {badge && <span className="bg-brand-soft text-brand-ink rounded px-1.5 py-0.5 text-[11px] font-bold">{badge}</span>}
          </p>
        </div>
        <div className="bg-muted text-muted-foreground relative grid size-28 shrink-0 place-items-center overflow-hidden rounded-lg sm:size-32">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- local data URL or the ad's own photo
            <img src={photo} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-[11px]">
              <Icon className="size-7 opacity-50" />
              <span className="flex items-center gap-1 opacity-70">
                <ImageOff className="size-3" />
                بدون عکس
              </span>
            </span>
          )}
        </div>
      </Link>
      {footer && <div className="border-t px-3 py-2 sm:px-4">{footer}</div>}
    </article>
  );
}

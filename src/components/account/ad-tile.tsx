import Link from "next/link";

import { ListingPhoto } from "@/components/listing-photo";
import { PhotoPlaceholder } from "@/components/photo-placeholder";
import { priceLineFa, roomsFa, timeAgoFa } from "@/lib/format";
import { toFaDigits } from "@/lib/persian";
import { photoSources } from "@/lib/photo";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  // a photo posted on Torob, else the real ad's own (our copy, then Divar's CDN)
  const sources = image ? [image] : photoSources(l);
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
        <div className="relative size-28 shrink-0 overflow-hidden rounded-lg sm:size-32">
          <PhotoPlaceholder listing={l} />
          {/* covers the placeholder; if every source fails it renders nothing and the placeholder stays */}
          <ListingPhoto
            sources={sources}
            className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </div>
      </Link>
      {footer && <div className="border-t px-3 py-2 sm:px-4">{footer}</div>}
    </article>
  );
}

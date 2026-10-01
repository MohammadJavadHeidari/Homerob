import { Building2, House, Store, TentTree } from "lucide-react";

import { categoryOf, type CategoryKey } from "@/lib/categories";
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
 * Stand-in for an ad's photo (none, still loading, or failed): a calm neutral gradient with the category's icon
 * in a white disc — no "broken image" signal. Fills its parent; `<ListingPhoto>` goes on top of it.
 * `label` (e.g. the neighborhood) sits under the icon; `size="lg"` for the ad page's gallery.
 */
export function PhotoPlaceholder({
  listing,
  label,
  size = "sm",
  className,
}: {
  listing: Pick<Listing, "category">;
  label?: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  const Icon = ICON[categoryOf(listing)];
  return (
    <div
      aria-hidden
      className={cn(
        "from-muted to-border text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br",
        className,
      )}
    >
      <span className={cn("bg-card/80 grid place-items-center rounded-full shadow-xs", size === "lg" ? "size-20" : "size-11")}>
        <Icon className={cn("opacity-70", size === "lg" ? "size-9" : "size-5")} strokeWidth={1.5} />
      </span>
      {label && <span className="max-w-[90%] truncate text-[11px] font-medium">{label}</span>}
    </div>
  );
}

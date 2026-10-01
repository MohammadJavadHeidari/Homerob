"use client";

import { Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AdTile } from "@/components/account/ad-tile";
import { Button } from "@/components/ui/button";
import { usePublishedAds } from "@/lib/account/ads-store";
import { trackImpressions } from "@/lib/account/events-store";
import { useSessions } from "@/lib/account/session";
import { CATEGORIES, CATEGORY_KEYS, categoryOf, type CategoryKey } from "@/lib/categories";
import { toFaDigits } from "@/lib/persian";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE = 24;

/** «آگهی‌ها»: everything, newest first, with category and city chips; the AI search box hands off to the home search. */
export function AdsBrowser({ real }: { real: Listing[] }) {
  const posted = usePublishedAds();
  const sessions = useSessions();
  const router = useRouter();
  const [category, setCategory] = useState<CategoryKey | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);

  const all = useMemo(() => [...posted, ...real].sort((a, b) => b.postedAt.localeCompare(a.postedAt)), [posted, real]);
  const cities = useMemo(() => [...new Set(all.map((l) => l.city))], [all]);
  const counts = useMemo(() => {
    const c = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0])) as Record<CategoryKey, number>;
    for (const l of all) if (!city || l.city === city) c[categoryOf(l)]++;
    return c;
  }, [all, city]);
  const list = all.filter((l) => (!category || categoryOf(l) === category) && (!city || l.city === city));
  const page = list.slice(0, shown);
  const images = useMemo(() => new Map(posted.map((a) => [a.id, a.images[0]])), [posted]);

  const pageIds = page.map((l) => l.id).join(",");
  useEffect(() => {
    trackImpressions(pageIds.split(",").filter((id) => id.startsWith("hr-")));
  }, [pageIds]);

  const badgeOf = (l: Listing) => {
    const a = posted.find((p) => p.id === l.id);
    if (!a) return undefined;
    const mine = sessions[a.owner]?.phone === a.ownerPhone;
    return mine ? "آگهی شما" : a.owner === "agency" ? a.ownerName || "املاک" : "ثبت در ترب";
  };

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">آگهی‌های املاک</h1>
        <p className="text-muted-foreground text-sm">
          {toFaDigits(list.length)} آگهی{city ? ` در ${city}` : ""}، تازه‌ترین‌ها اول
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim().length >= 2) router.push(`/?q=${encodeURIComponent(q.trim())}`);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Sparkles className="text-primary pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجوی هوشمند: دوخوابه نزدیک مترو تا ۸۰۰ رهن"
            aria-label="جستجوی هوشمند"
            className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/40 h-11 w-full rounded-lg border ps-9 pe-3 text-sm outline-none focus-visible:ring-3"
          />
        </div>
        <Button type="submit" size="lg" className="h-11 px-4">
          <Search />
          <span className="hidden sm:inline">جستجو</span>
        </Button>
      </form>

      <div className="flex flex-col gap-2">
        <Chips>
          <Chip on={!category} onClick={() => setCategory(null)}>
            همه
          </Chip>
          {CATEGORY_KEYS.filter((k) => counts[k] > 0).map((k) => (
            <Chip key={k} on={category === k} onClick={() => setCategory(category === k ? null : k)}>
              {CATEGORIES[k].label}
              <span className="opacity-60">{toFaDigits(counts[k])}</span>
            </Chip>
          ))}
        </Chips>
        {cities.length > 1 && (
          <Chips>
            <Chip on={!city} onClick={() => setCity(null)}>
              همهٔ شهرها
            </Chip>
            {cities.map((c) => (
              <Chip key={c} on={city === c} onClick={() => setCity(city === c ? null : c)}>
                {c}
              </Chip>
            ))}
          </Chips>
        )}
      </div>

      {page.length ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {page.map((l) => (
            <AdTile key={l.id} listing={l} image={images.get(l.id)} href={`/ads/${l.id}`} badge={badgeOf(l)} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground rounded-2xl border border-dashed px-6 py-12 text-center text-sm">آگهی‌ای با این فیلترها نیست.</p>
      )}
      {list.length > shown && (
        <Button variant="outline" className="mx-auto h-10 px-6" onClick={() => setShown((s) => s + PAGE)}>
          آگهی‌های بیشتر
        </Button>
      )}
    </>
  );
}

function Chips({ children }: { children: React.ReactNode }) {
  return <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">{children}</div>;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
        on ? "bg-foreground text-background border-foreground" : "bg-secondary border-input hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

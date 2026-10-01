"use client";

import { Bookmark, Eye, History, LayoutGrid, LogOut, Pencil, Phone, Plus, Power, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AdTile } from "@/components/account/ad-tile";
import { RequireSession } from "@/components/account/require-session";
import { Button, buttonVariants } from "@/components/ui/button";
import { isPostedId, type PostedAd } from "@/lib/account/ads";
import { deleteAd, setAdStatus, useOwnAds, usePostedAds } from "@/lib/account/ads-store";
import { useAdEvents } from "@/lib/account/events-store";
import { formatMobile, signOut, type Session } from "@/lib/account/session";
import { overview } from "@/lib/account/stats";
import { toFaDigits } from "@/lib/persian";
import { useTaste } from "@/lib/taste-store";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "ads" | "saved" | "recent";

/** «ترب من»: the customer's own ads (with how often each was seen), saved ads, recently viewed. */
export function MyPanel() {
  return (
    <RequireSession
      role="user"
      intro={
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold">ترب من</h1>
          <p className="text-muted-foreground text-sm">آگهی‌هات، نشان‌شده‌ها و بازدیدهای اخیرت اینجاست.</p>
        </div>
      }
    >
      {(s) => <Panel session={s} />}
    </RequireSession>
  );
}

function Panel({ session }: { session: Session }) {
  const [tab, setTab] = useState<Tab>("ads");
  const ads = useOwnAds("user", session.phone);
  const taste = useTaste();
  const tabs: { key: Tab; label: string; icon: typeof Bookmark; count: number }[] = [
    { key: "ads", label: "آگهی‌های من", icon: LayoutGrid, count: ads.length },
    { key: "saved", label: "نشان‌شده‌ها", icon: Bookmark, count: taste.saved.length },
    { key: "recent", label: "بازدیدهای اخیر", icon: History, count: taste.viewed.length },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      <aside className="flex flex-col gap-3">
        <div className="bg-card flex items-center gap-3 rounded-2xl p-4 sm:rounded-lg">
          <span className="bg-muted grid size-11 place-items-center rounded-full">
            <UserRound className="text-muted-foreground size-5" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-bold">کاربر ترب</span>
            <span dir="ltr" className="text-muted-foreground text-end text-xs">
              {formatMobile(session.phone)}
            </span>
          </div>
        </div>
        <nav className="bg-card no-scrollbar flex gap-1 overflow-x-auto rounded-2xl p-1.5 sm:rounded-lg md:flex-col">
          {tabs.map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                tab === key ? "bg-foreground text-background font-medium" : "hover:bg-muted",
              )}
            >
              <Icon className="size-4" />
              <span className="flex-1 text-start">{label}</span>
              <span className={cn("rounded px-1.5 text-xs", tab === key ? "bg-background/20" : "bg-muted text-muted-foreground")}>{toFaDigits(count)}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => signOut("user")}
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm"
          >
            <LogOut className="size-4" />
            خروج
          </button>
        </nav>
      </aside>

      <section className="flex min-w-0 flex-col gap-4">
        {tab === "ads" && <MyAds ads={ads} />}
        {tab === "saved" && <IdList ids={taste.saved} empty="هنوز چیزی نشان نکردی. روی آگهی‌ها «نشان کردن» یا ♥ رو بزن." />}
        {tab === "recent" && <IdList ids={taste.viewed} empty="هنوز آگهی‌ای باز نکردی." />}
      </section>
    </div>
  );
}

function MyAds({ ads }: { ads: PostedAd[] }) {
  const events = useAdEvents();
  const stats = useMemo(() => overview(events, ads.map((a) => a.id)), [events, ads]);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">آگهی‌های من</h1>
        <div className="flex gap-2">
          <Link href="/ads" className={buttonVariants({ variant: "outline", className: "h-9 px-3" })}>
            دیدن آگهی‌های دیگران
          </Link>
          <Link href="/new" className={buttonVariants({ className: "h-9 px-3 font-bold" })}>
            <Plus />
            ثبت آگهی
          </Link>
        </div>
      </div>
      {ads.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {ads.map((a) => {
            const s = stats.byAd[a.id];
            const off = a.status === "archived";
            return (
              <AdTile
                key={a.id}
                listing={a}
                image={a.images[0]}
                href={`/ads/${a.id}`}
                className={cn(off && "opacity-60")}
                footer={
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                    <span className="flex items-center gap-1" title="بازدید">
                      <Eye className="text-muted-foreground size-3.5" />
                      {toFaDigits(s.view)} بازدید
                    </span>
                    <span className="flex items-center gap-1" title="تماس">
                      <Phone className="text-muted-foreground size-3.5" />
                      {toFaDigits(s.contact)} تماس
                    </span>
                    <span className={cn("rounded px-1.5 py-0.5", off ? "bg-muted" : "bg-success/10 text-success")}>{off ? "غیرفعال" : "منتشر شده"}</span>
                    <span className="ms-auto flex gap-1">
                      <Link href={`/new?edit=${a.id}`} aria-label="ویرایش" className={buttonVariants({ variant: "ghost", size: "icon-sm" })}>
                        <Pencil />
                      </Link>
                      <Button variant="ghost" size="icon-sm" aria-label={off ? "فعال کردن" : "غیرفعال کردن"} onClick={() => setAdStatus(a.id, off ? "published" : "archived")}>
                        <Power />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="حذف"
                        onClick={() => {
                          if (confirm("این آگهی حذف بشه؟")) deleteAd(a.id);
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </span>
                  </div>
                }
              />
            );
          })}
        </div>
      ) : (
        <div className="bg-card flex flex-col items-center gap-3 rounded-2xl px-6 py-12 text-center sm:rounded-lg">
          <LayoutGrid className="text-muted-foreground size-10" />
          <h2 className="font-bold">هنوز آگهی‌ای ثبت نکردی</h2>
          <p className="text-muted-foreground text-sm">خونه یا مغازه‌ت رو برای فروش یا اجاره بذار؛ رایگانه.</p>
          <Link href="/new" className={buttonVariants({ size: "lg", className: "h-10 px-5 font-bold" })}>
            <Plus />
            ثبت اولین آگهی
          </Link>
        </div>
      )}
    </>
  );
}

/** Saved / recently viewed: ads posted on this device come from the store, real ones from /api/listings. */
function IdList({ ids, empty }: { ids: string[]; empty: string }) {
  const posted = usePostedAds();
  const [real, setReal] = useState<Listing[] | null>(null);
  const realIds = ids.filter((id) => !isPostedId(id)).join(",");
  useEffect(() => {
    if (!realIds) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- nothing to fetch
      setReal([]);
      return;
    }
    const ctrl = new AbortController();
    fetch(`/api/listings?ids=${encodeURIComponent(realIds)}`, { signal: ctrl.signal })
      .then((r) => r.json() as Promise<{ listings: Listing[] }>)
      .then((j) => setReal(j.listings))
      .catch(() => {});
    return () => ctrl.abort();
  }, [realIds]);

  if (!ids.length) return <p className="text-muted-foreground bg-card rounded-2xl px-6 py-12 text-center text-sm sm:rounded-lg">{empty}</p>;
  if (!real) return <div className="bg-muted h-40 animate-pulse rounded-2xl" />;
  const byId = new Map<string, Listing & { images?: string[] }>([...real.map((l) => [l.id, l] as const), ...posted.map((a) => [a.id, a] as const)]);
  const items = ids.map((id) => byId.get(id)).filter((l): l is Listing & { images?: string[] } => Boolean(l));
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {items.map((l) => (
        <AdTile key={l.id} listing={l} image={l.images?.[0]} href={`/ads/${l.id}`} />
      ))}
    </div>
  );
}

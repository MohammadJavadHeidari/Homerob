"use client";

import { Eye, FileUp, Heart, Pencil, Phone, Power, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AdTile } from "@/components/account/ad-tile";
import { useAgency } from "@/components/agency/use-agency";
import { Button, buttonVariants } from "@/components/ui/button";
import { deleteAd, setAdStatus } from "@/lib/account/ads-store";
import { toFaDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

type Filter = "all" | "published" | "archived";

/** «فایل‌ها»: every file the agency uploaded, with its numbers and edit / pause / delete. */
export function FilesList() {
  const { ads, stats } = useAgency();
  const [filter, setFilter] = useState<Filter>("all");
  const list = ads.filter((a) => filter === "all" || a.status === filter);
  const count = (f: Filter) => ads.filter((a) => f === "all" || a.status === f).length;
  const labels: Record<Filter, string> = { all: "همه", published: "منتشر شده", archived: "غیرفعال" };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold">فایل‌ها</h1>
          <p className="text-muted-foreground text-sm">{toFaDigits(ads.length)} فایل آپلود کردی.</p>
        </div>
        <Link href="/agency/upload" className={buttonVariants({ className: "h-9 px-4 font-bold" })}>
          <FileUp />
          آپلود فایل
        </Link>
      </div>
      <div className="flex gap-2">
        {(Object.keys(labels) as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
              filter === f ? "bg-foreground text-background border-foreground" : "bg-secondary border-input hover:bg-muted",
            )}
          >
            {labels[f]}
            <span className="opacity-60">{toFaDigits(count(f))}</span>
          </button>
        ))}
      </div>
      {list.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((a) => {
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
                    <Stat icon={Eye} value={s.view} label="بازدید" />
                    <Stat icon={Phone} value={s.contact} label="تماس" />
                    <Stat icon={Heart} value={s.save} label="نشان" />
                    <span className="ms-auto flex gap-1">
                      <Link href={`/agency/upload?edit=${a.id}`} aria-label="ویرایش" className={buttonVariants({ variant: "ghost", size: "icon-sm" })}>
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
                          if (confirm("این فایل حذف بشه؟")) deleteAd(a.id);
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
        <p className="bg-card text-muted-foreground rounded-2xl px-6 py-12 text-center text-sm sm:rounded-lg">فایلی اینجا نیست.</p>
      )}
    </>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Eye; value: number; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <Icon className="text-muted-foreground size-3.5" />
      {toFaDigits(value)} {label}
    </span>
  );
}

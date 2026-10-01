"use client";

import { CircleCheck, Eye, LayoutList, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AdForm } from "@/components/account/ad-form";
import { AiFill } from "@/components/account/ai-fill";
import { RequireSession } from "@/components/account/require-session";
import { Button, buttonVariants } from "@/components/ui/button";
import { adToDraft, draftToAd, EMPTY_DRAFT, type AdDraft, type PostedAd } from "@/lib/account/ads";
import { addAds, readPostedAds, updateAd } from "@/lib/account/ads-store";
import type { Session } from "@/lib/account/session";

/** Customer «ثبت آگهی» (and edit with ?edit=<id>). */
export function NewAd() {
  return (
    <RequireSession
      role="user"
      intro={
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold">ثبت رایگان آگهی ملک</h1>
          <p className="text-muted-foreground text-sm">برای ثبت آگهی، اول با شماره موبایلت وارد شو.</p>
        </div>
      }
    >
      {(s) => <Editor session={s} />}
    </RequireSession>
  );
}

function Editor({ session }: { session: Session }) {
  const [draft, setDraft] = useState<AdDraft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState<PostedAd | null>(null);
  const [done, setDone] = useState<PostedAd | null>(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("edit");
    const ad = id ? readPostedAds().find((a) => a.id === id && a.ownerPhone === session.phone) : undefined;
    if (ad) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- load the ad being edited once, from the URL
      setEditing(ad);
      setDraft(adToDraft(ad));
    }
  }, [session.phone]);

  if (done)
    return (
      <div className="bg-card mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-2xl p-8 text-center">
        <CircleCheck className="text-success size-12" />
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-bold">{editing ? "آگهی‌ت به‌روز شد" : "آگهی‌ت منتشر شد"}</h1>
          <p className="text-muted-foreground text-sm leading-6">از همین الان تو «آگهی‌ها» و جستجوی هوشمند ترب دیده می‌شه.</p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Link href={`/ads/${done.id}`} className={buttonVariants({ size: "lg", className: "h-11" })}>
            <Eye />
            دیدن آگهی
          </Link>
          <Link href="/my" className={buttonVariants({ variant: "outline", size: "lg", className: "h-11" })}>
            <LayoutList />
            آگهی‌های من
          </Link>
          <Button
            variant="ghost"
            size="lg"
            className="h-11"
            onClick={() => {
              setDone(null);
              setEditing(null);
              setDraft(EMPTY_DRAFT);
              setFormKey((k) => k + 1);
              window.history.replaceState(null, "", "/new");
            }}
          >
            <Plus />
            ثبت یه آگهی دیگه
          </Button>
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">{editing ? "ویرایش آگهی" : "ثبت رایگان آگهی ملک"}</h1>
        <p className="text-muted-foreground text-sm">آگهی‌ت هم تو «آگهی‌ها» میاد، هم وقتی کسی با زبان خودش دنبال همچین خونه‌ای بگرده.</p>
      </div>
      {!editing && (
        <AiFill
          city={draft.city}
          onDraft={(d) => {
            setDraft({ ...d, images: draft.images });
            setFormKey((k) => k + 1);
          }}
        />
      )}
      <div className="bg-card rounded-2xl p-4 sm:rounded-lg sm:p-6">
        <AdForm
          key={formKey}
          value={draft}
          onChange={setDraft}
          submitLabel={editing ? "ذخیرهٔ تغییرات" : "انتشار آگهی"}
          onSubmit={(d) => {
            const owner = { role: "user" as const, phone: session.phone, name: "" };
            const ad = draftToAd(d, owner, editing?.via ?? "form", editing ?? undefined);
            if (editing) updateAd(ad);
            else addAds([ad]);
            setDone(ad);
            window.scrollTo({ top: 0 });
          }}
        />
      </div>
    </div>
  );
}

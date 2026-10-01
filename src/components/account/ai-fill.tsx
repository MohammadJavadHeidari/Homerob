"use client";

import { LoaderCircle, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { AdDraft } from "@/lib/account/ads";
import { cn } from "@/lib/utils";

/**
 * «متن آگهی رو بچسبون»: paste a property's description (a Telegram post, notes, an old ad) and the form fills
 * itself via /api/parse-ad (the search intent parser: LLM when configured, rules otherwise). Phone numbers in the
 * text are dropped on the server. The result is a draft to check, never published as is.
 */
export function AiFill({ city, onDraft, className }: { city: string; onDraft: (d: AdDraft) => void; className?: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const run = async () => {
    if (text.trim().length < 10) return setNote("چند کلمه بیشتر بنویس: متراژ، اتاق، محله، قیمت…");
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/parse-ad", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, city }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { draft: AdDraft; source: "ai" | "rules" };
      onDraft(json.draft);
      setNote("فرم پر شد. یه نگاه بنداز و هر جا لازمه درستش کن.");
    } catch {
      setNote("الان نشد. دوباره امتحان کن یا فرم رو دستی پر کن.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("bg-card flex flex-col gap-3 rounded-2xl p-4 sm:rounded-lg", className)}>
      <div className="flex items-start gap-2">
        <Sparkles className="text-primary mt-0.5 size-4 shrink-0" />
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-bold">متن آگهی رو بچسبون، فرم خودش پر می‌شه</h3>
          <p className="text-muted-foreground text-xs leading-5">از تلگرام، یادداشت یا آگهی قبلی. شماره‌تلفن‌های داخل متن نگه داشته نمی‌شه.</p>
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        maxLength={3000}
        aria-label="متن آگهی"
        placeholder="مثلاً: آپارتمان ۹۰ متری دوخوابه وکیل‌آباد، طبقه ۳، آسانسور و پارکینگ، رهن ۵۰۰ میلیون اجاره ۱۰ میلیون، قابل تبدیل"
        className="border-input bg-secondary focus-visible:border-ring focus-visible:ring-ring/40 w-full rounded-lg border px-3 py-2.5 text-sm leading-7 outline-none focus-visible:ring-3"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" className="border-input h-9 border px-4" onClick={run} disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Sparkles className="text-primary" />}
          پر کردن فرم با هوش مصنوعی
        </Button>
        {note && <p className="text-muted-foreground text-xs">{note}</p>}
      </div>
    </div>
  );
}

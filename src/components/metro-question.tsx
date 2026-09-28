"use client";

import { Questionnaire as Q } from "@shadcn/react/questionnaire";
import { ArrowUp, Pencil, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { SearchApiResponse } from "@/lib/api-types";
import { searchCity } from "@/lib/intent/place";
import { lineColour, metroLinesIn, nearLines, shouldAskLine, WALK_MAX_MIN } from "@/lib/metro";
import { toEnDigits, toFaDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

/** The city the results are from: the one asked for, else the only city in the results. */
function resultsCity(data: SearchApiResponse): string | null {
  const cities = new Set(data.results.map((r) => r.listing.city));
  return searchCity(data.intent) ?? (cities.size === 1 ? [...cities][0] : null);
}

/** Whether to ask "which line?" for these results. */
export const asksMetroLine = (data: SearchApiResponse) => data.total > 0 && shouldAskLine(data.intent, resultsCity(data));

/**
 * "Which metro line?" — asked on the results page when the user wants to live near the metro and the
 * city has more than one line. Styled after Claude's question box: numbered rows (a click, a number key
 * or ↑↓ + Enter answers), a free-text «یه چیز دیگه» row, «فرقی نمی‌کنه» / Esc / ✕ to skip.
 * Built on shadcn's Questionnaire primitive (form semantics, ↑↓ focus, Enter to submit).
 */
export function MetroQuestion({
  data,
  onPick,
  onText,
  onAnyLine,
}: {
  data: SearchApiResponse;
  /** A line was chosen: re-search with it (no LLM). */
  onPick: (refs: string[]) => void;
  /** Free text instead of a line: added to the query and searched again. */
  onText: (text: string) => void;
  /** Skip: any line is fine. */
  onAnyLine: () => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [text, setText] = useState("");
  const city = resultsCity(data);
  const lines = metroLinesIn(city);
  // how many of these results sit a short walk from each line
  const counts = useMemo(
    () => new Map(lines.map((l) => [l.ref, data.results.filter((r) => nearLines(r.listing, [l.ref])).length])),
    [lines, data.results],
  );
  const submitSoon = () => setTimeout(() => form.current?.requestSubmit(), 0);
  // free text skips the form: the questionnaire won't submit while no line is picked
  const sendText = () => {
    if (text.trim()) onText(text.trim());
  };

  return (
    <div className="w-full max-w-2xl">
      <Q.Root
        ref={form}
        className="bg-card rounded-2xl border shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          const picked = new FormData(e.currentTarget).get("line");
          if (typeof picked === "string" && picked) onPick([picked]);
          else onAnyLine();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onAnyLine();
            return;
          }
          // number keys (Latin or Persian) answer right away, like Claude's box
          const d = toEnDigits(e.key);
          const typing = e.target instanceof HTMLInputElement && e.target.type === "text";
          if (typing || !/^[1-9]$/.test(d)) return;
          const line = lines[Number(d) - 1];
          if (!line || !counts.get(line.ref)) return;
          e.preventDefault();
          form.current?.querySelector<HTMLInputElement>(`input[name="line"][value="${line.ref}"]`)?.click();
          submitSoon();
        }}
      >
        <Q.Item name="line" className="flex flex-col border-0 p-0">
          <div className="flex items-start gap-3 px-5 pt-5 pb-3">
            <Q.Title className="flex-1 text-lg leading-8 font-bold">نزدیک کدوم خط مترو؟</Q.Title>
            <button
              type="button"
              onClick={onAnyLine}
              aria-label="بستن (فرقی نمی‌کنه)"
              className="text-muted-foreground hover:bg-muted hover:text-foreground -me-1 grid size-8 shrink-0 place-items-center rounded-lg transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>
          <Q.Description className="text-muted-foreground -mt-2 px-5 pb-3 text-sm">
            فقط خونه‌هایی رو نشون می‌دم که تا یه ایستگاهش حداکثر {toFaDigits(WALK_MAX_MIN)} دقیقه پیاده‌ان.
          </Q.Description>

          <Q.Choices className="flex flex-col px-2">
            {lines.map((l, i) => {
              const n = counts.get(l.ref) ?? 0;
              return (
                <Q.Choice
                  key={l.ref}
                  value={l.ref}
                  disabled={n === 0}
                  // a real click answers at once; ↑↓ also "click" the radio (detail 0) and must only move
                  onClick={(e) => {
                    if (e.detail > 0 && n > 0) submitSoon();
                  }}
                  className={cn(
                    "group relative flex min-h-16 cursor-pointer items-center gap-4 rounded-xl px-3 py-3 transition-colors",
                    "after:bg-border after:absolute after:inset-x-3 after:bottom-0 after:h-px last:after:hidden",
                    "hover:bg-muted has-[:focus-visible]:bg-muted data-checked:bg-muted",
                    "data-disabled:cursor-not-allowed data-disabled:opacity-50",
                  )}
                >
                  <Q.ChoiceInput className="absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed" />
                  <span
                    aria-hidden
                    className="grid size-10 shrink-0 place-items-center rounded-xl text-base font-bold text-white"
                    style={{ background: lineColour(l) }}
                  >
                    {toFaDigits(i + 1)}
                  </span>
                  <Q.ChoiceLabel className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-foreground text-base font-medium">
                      {l.name}: {l.from} ↔ {l.to}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {toFaDigits(l.stations.length)} ایستگاه · {n ? `${toFaDigits(n)} آگهی نزدیکش` : "فعلاً آگهی‌ای نزدیکش نداریم"}
                    </span>
                  </Q.ChoiceLabel>
                </Q.Choice>
              );
            })}
          </Q.Choices>
        </Q.Item>

        {/* «Something else»: free text, added to the query and searched again */}
        <div className="bg-muted/60 m-2 mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5">
          <span aria-hidden className="bg-foreground text-background grid size-10 shrink-0 place-items-center rounded-xl">
            <Pencil className="size-4" />
          </span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                sendText();
              }
            }}
            maxLength={120}
            placeholder="یه چیز دیگه…"
            aria-label="یه چیز دیگه"
            className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none"
          />
          {text.trim() ? (
            <Button type="button" size="icon" aria-label="بفرست" className="shrink-0 rounded-lg" onClick={sendText}>
              <ArrowUp />
            </Button>
          ) : (
            <Button type="button" variant="outline" className="shrink-0" onClick={onAnyLine}>
              فرقی نمی‌کنه
            </Button>
          )}
        </div>
      </Q.Root>
      <p className="text-muted-foreground mt-2 hidden justify-center gap-5 text-xs sm:flex">
        <span>↑↓ جابه‌جایی</span>
        <span>Enter انتخاب</span>
        <span>Esc رد شدن</span>
      </p>
    </div>
  );
}

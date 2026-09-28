"use client";

import { TramFront } from "lucide-react";
import { useMemo } from "react";

import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireItem,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@/components/ui/questionnaire";
import type { SearchApiResponse } from "@/lib/api-types";
import { searchCity } from "@/lib/intent/place";
import { lineColour, metroLinesIn, nearLines, shouldAskLine } from "@/lib/metro";
import { toFaDigits } from "@/lib/persian";

/** The city the results are from: the one asked for, else the only city in the results. */
function resultsCity(data: SearchApiResponse): string | null {
  const cities = new Set(data.results.map((r) => r.listing.city));
  return searchCity(data.intent) ?? (cities.size === 1 ? [...cities][0] : null);
}

/** Whether to ask "which line?" for these results. */
export const asksMetroLine = (data: SearchApiResponse) => data.total > 0 && shouldAskLine(data.intent, resultsCity(data));

/**
 * "Which metro line?" — asked on the results page when the user wants to live near the metro and the
 * city has more than one line. Picking lines re-searches with `metroLines` (no LLM); «فرقی نمی‌کنه»
 * keeps every line.
 */
export function MetroQuestion({
  data,
  onPick,
  onAnyLine,
}: {
  data: SearchApiResponse;
  onPick: (refs: string[]) => void;
  onAnyLine: () => void;
}) {
  const city = resultsCity(data);
  const lines = metroLinesIn(city);
  // how many of these results sit a short walk from each line
  const counts = useMemo(
    () => new Map(lines.map((l) => [l.ref, data.results.filter((r) => nearLines(r.listing, [l.ref])).length])),
    [lines, data.results],
  );

  return (
    <div className="bg-card w-full max-w-xl rounded-2xl border p-4 shadow-xs sm:p-5">
      <Questionnaire
        shortcuts="numbers"
        onSubmit={(e) => {
          e.preventDefault();
          const refs = new FormData(e.currentTarget).getAll("line").map(String);
          if (refs.length) onPick(refs);
          else onAnyLine();
        }}
      >
        <QuestionnaireItem name="line" multiple>
          <div className="flex flex-col gap-1">
            <QuestionnaireTitle className="flex items-center gap-2 font-bold">
              <TramFront className="text-primary size-5 shrink-0" />
              نزدیک کدوم خط مترو؟
            </QuestionnaireTitle>
            <QuestionnaireDescription>
              {city} {toFaDigits(lines.length)} خط مترو داره. بگو کدوم خط به کارت میاد (دانشگاه، محل کار…) تا فقط خونه‌هایی رو نشون بدم که تا یه
              ایستگاهش حداکثر ۱۵ دقیقه پیاده‌ان. چندتا هم می‌تونی انتخاب کنی.
            </QuestionnaireDescription>
          </div>
          <QuestionnaireChoices>
            {lines.map((l) => {
              const n = counts.get(l.ref) ?? 0;
              return (
                <QuestionnaireChoice key={l.ref} value={l.ref} disabled={n === 0}>
                  <span className="flex items-center gap-2 font-medium">
                    <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: lineColour(l) }} />
                    {l.name}: {l.from} ↔ {l.to}
                  </span>
                  <QuestionnaireChoiceDescription>
                    {toFaDigits(l.stations.length)} ایستگاه ·{" "}
                    {n ? `${toFaDigits(n)} آگهی نزدیکش` : "فعلاً آگهی‌ای نزدیکش نداریم"}
                  </QuestionnaireChoiceDescription>
                </QuestionnaireChoice>
              );
            })}
          </QuestionnaireChoices>
        </QuestionnaireItem>
        <QuestionnaireActions>
          <QuestionnaireSkip>فرقی نمی‌کنه</QuestionnaireSkip>
          <QuestionnaireSubmit>همین‌ها رو نشون بده</QuestionnaireSubmit>
        </QuestionnaireActions>
      </Questionnaire>
    </div>
  );
}

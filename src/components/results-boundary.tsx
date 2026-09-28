"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { catchError, type ErrorInfo } from "next/error";

import { Button } from "@/components/ui/button";

/**
 * If something in the results area crashes, keep the page (header + search box) and say what broke,
 * instead of Next's full-page «This page couldn't load». The error text helps to fix it.
 */
function ResultsError({ onRetry }: { onRetry: () => void }, { error, reset }: ErrorInfo) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed px-6 py-12 text-center">
      <TriangleAlert className="text-warning size-10" />
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold">نمایش نتایج به مشکل خورد</h2>
        <p className="text-muted-foreground text-sm">دوباره امتحان کن. اگه باز تکرار شد، متن زیر رو برامون بفرست.</p>
      </div>
      <code dir="ltr" className="bg-muted text-muted-foreground max-w-full rounded-md px-3 py-2 text-start text-xs break-words whitespace-pre-wrap">
        {error instanceof Error ? `${error.name}: ${error.message}` : String(error)}
      </code>
      <Button
        variant="outline"
        onClick={() => {
          reset();
          onRetry();
        }}
      >
        <RotateCcw />
        دوباره
      </Button>
    </div>
  );
}

export const ResultsBoundary = catchError(ResultsError);

"use client";

import { Home, RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Our own fallback instead of Next's bare "This page couldn't load": Persian, a way back home (a full
 * load, so a broken client state can't follow), and the error's message so a report says what broke.
 */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <TriangleAlert className="text-primary size-10" />
      <h1 className="text-xl font-bold">یه چیزی درست کار نکرد</h1>
      <p className="text-muted-foreground text-sm leading-7">دوباره امتحان کن یا از صفحهٔ اول شروع کن.</p>
      <div className="flex gap-2">
        {/* eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load on purpose */}
        <Button onClick={() => window.location.assign("/")}>
          <Home />
          صفحهٔ اول
        </Button>
        <Button variant="outline" onClick={retry}>
          <RotateCcw />
          تلاش دوباره
        </Button>
      </div>
      <p dir="ltr" className="text-muted-foreground/70 mt-4 max-w-full font-mono text-[11px] break-words">
        {error.message || "Unknown error"}
        {error.digest && ` (${error.digest})`}
      </p>
    </main>
  );
}

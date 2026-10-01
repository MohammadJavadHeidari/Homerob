"use client";

import { useEffect, useRef, useState } from "react";

/**
 * An ad's photo with fallbacks: tries `sources` in order (our copy first, then Divar's CDN, which answers
 * only Iranian IPs) and renders nothing once all fail, so whatever sits underneath (a placeholder) shows.
 */
export function ListingPhoto({ sources, className }: { sources: string[]; className?: string }) {
  const key = sources.join("|");
  const [failed, setFailed] = useState({ key, n: 0 });
  const n = failed.key === key ? failed.n : 0;
  const ref = useRef<HTMLImageElement>(null);
  const src = sources[n];

  // An error before hydration never reaches onError: catch an image that has already failed.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) setFailed({ key, n: n + 1 });
  }, [key, n]);

  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- our static copy, Divar's CDN or a local data URL; next/image can't fetch Divar from Vercel
    <img
      ref={ref}
      key={src}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed({ key, n: n + 1 })}
      className={className}
    />
  );
}

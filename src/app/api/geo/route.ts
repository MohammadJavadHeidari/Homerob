import { NextResponse } from "next/server";

/**
 * Coarse visitor location from Vercel's IP geolocation headers (no third-party service,
 * no browser permission prompt). Empty locally or when the headers are missing.
 */
export function GET(request: Request) {
  const h = request.headers;
  const decode = (v: string | null) => {
    if (!v) return null;
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  const num = (v: string | null) => (v && Number.isFinite(Number(v)) ? Number(v) : null);
  return NextResponse.json(
    {
      country: h.get("x-vercel-ip-country"),
      city: decode(h.get("x-vercel-ip-city")),
      lat: num(h.get("x-vercel-ip-latitude")),
      lon: num(h.get("x-vercel-ip-longitude")),
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}

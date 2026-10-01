import { describe, expect, it } from "vitest";

import { photoSources } from "@/lib/photo";
import type { Listing } from "@/lib/types";

import { linkPhotos } from "./photos";

const ad = (id: string, extra: Partial<Listing> = {}) => ({ id, imageUrl: `https://s100.divarcdn.com/${id}.webp`, ...extra }) as Listing;

describe("linkPhotos", () => {
  it("links a downloaded copy, unlinks a missing one, keeps the source photo", () => {
    const [a, b] = linkPhotos([ad("dv-a"), ad("dv-b", { photo: "/img/divar/dv-b.webp" })], (id) => id === "dv-a", new Set());
    expect(a.photo).toBe("/img/divar/dv-a.webp");
    expect(b.photo).toBeUndefined();
    expect(b.imageUrl).toBe("https://s100.divarcdn.com/dv-b.webp");
  });

  it("hides every photo of a hidden ad", () => {
    const [a] = linkPhotos([ad("dv-a")], () => true, new Set(["dv-a"]));
    expect(a.photo).toBeUndefined();
    expect(a.imageUrl).toBeUndefined();
  });
});

describe("photoSources", () => {
  it("tries our copy first, then the source", () => {
    expect(photoSources({ photo: "/img/divar/x.webp", imageUrl: "https://cdn/x.webp" })).toEqual(["/img/divar/x.webp", "https://cdn/x.webp"]);
    expect(photoSources({ imageUrl: "https://cdn/x.webp" })).toEqual(["https://cdn/x.webp"]);
    expect(photoSources({})).toEqual([]);
  });
});

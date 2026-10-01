import type { Listing } from "@/lib/types";

export const PHOTO_DIR = "public/img/divar";

/** Public path of a downloaded Divar thumbnail (see `python3 scripts/divar_crawler.py --images`). */
export const photoPath = (id: string) => `/img/divar/${id}.webp`;

/**
 * Points each listing at its downloaded thumbnail when the file exists, and drops `photo` when it doesn't.
 * Ids in `hidden` (e.g. a photo showing a phone number) lose both the copy and the source photo.
 */
export function linkPhotos(listings: Listing[], has: (id: string) => boolean, hidden: ReadonlySet<string>): Listing[] {
  return listings.map((l) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { photo, ...rest } = l;
    if (hidden.has(l.id)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { imageUrl, ...noPhoto } = rest;
      return noPhoto;
    }
    return has(l.id) ? { ...rest, photo: photoPath(l.id) } : rest;
  });
}

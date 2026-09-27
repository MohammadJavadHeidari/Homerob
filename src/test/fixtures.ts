import type { Listing } from "@/lib/types";

/**
 * Hand-written listings for unit tests of ranking, filters and data-quality rules — independent of
 * whatever real data is in src/data. Not ads, never served.
 */
const M = 1_000_000;

export function fixture(id: string, p: Partial<Listing>): Listing {
  return {
    id,
    source: id.startsWith("sp-") ? "sheypoor" : "divar",
    title: "آپارتمان تست",
    city: "مشهد",
    neighborhood: "وکیل‌آباد",
    street: "",
    deposit: 400 * M,
    monthlyRent: 15 * M,
    areaM2: 90,
    rooms: 2,
    floor: 2,
    totalFloors: 4,
    buildingAge: 5,
    elevator: true,
    parking: true,
    storage: true,
    tags: [],
    convertible: true,
    description: "",
    postedAt: "2026-09-20T08:00:00.000Z",
    ...p,
  };
}

const anchor = { neighborhood: "وکیل‌آباد", street: "وکیل‌آباد ۳۰", areaM2: 95, rooms: 2, floor: 2, deposit: 450 * M, monthlyRent: 15 * M, parking: false };

export const FIXTURES: Listing[] = [
  // flagship: 2-bed وکیل‌آباد around a 500M budget; the anchor is also posted on Sheypoor
  fixture("dv-anchor", anchor),
  fixture("sp-anchor", { ...anchor, postedAt: "2026-09-19T08:00:00.000Z" }),
  fixture("dv-vakil-2", { deposit: 420 * M, monthlyRent: 16 * M }),
  fixture("dv-vakil-3", { rooms: 3, areaM2: 120, deposit: 480 * M, monthlyRent: 22 * M }),
  fixture("dv-hashemiye", { neighborhood: "هاشمیه", deposit: 450 * M }),
  fixture("dv-vakil-1", { rooms: 1, areaM2: 60, deposit: 300 * M, monthlyRent: 8 * M }),
  fixture("dv-placeholder", { deposit: 1_000, monthlyRent: 1_000 }),
  // سجاد
  fixture("dv-sajjad-2", { neighborhood: "سجاد" }),
  fixture("dv-sajjad-2-noparking", { neighborhood: "سجاد", parking: false }),
  fixture("dv-shared", { neighborhood: "سجاد", title: "اجاره اتاق در واحد دوخوابه", rooms: 1, deposit: 40 * M, monthlyRent: 3 * M }),
  fixture("sp-shared", { neighborhood: "سجاد", title: "هم‌خونه خانم", rooms: 1, deposit: 30 * M, monthlyRent: 4 * M }),
  // احمدآباد
  fixture("dv-ahmad-parking", { neighborhood: "احمدآباد" }),
  fixture("dv-ahmad-noparking", { neighborhood: "احمدآباد", parking: false, deposit: 350 * M }),
  fixture("dv-ahmad-3", { neighborhood: "احمدآباد", rooms: 3, areaM2: 130 }),
  fixture("dv-studio", { neighborhood: "قاسم‌آباد", rooms: 0, areaM2: 40, deposit: 100 * M, monthlyRent: 6 * M }),
];

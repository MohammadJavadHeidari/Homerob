import { normalizeFa } from "./text";
import { NEIGHBORHOODS, type Neighborhood } from "./types";

const ALIASES: Record<Neighborhood, string[]> = {
  "الهیه": ["الهیه", "الاهیه"],
  "سجاد": ["سجاد", "بلوار سجاد"],
  "وکیل‌آباد": ["وکیل آباد", "وکیلاباد", "وکیل اباد"],
  "احمدآباد": ["احمد آباد", "احمداباد", "احمد اباد"],
  "هاشمیه": ["هاشمیه"],
  "قاسم‌آباد": ["قاسم آباد", "قاسماباد", "قاسم اباد"],
};

/** Neighborhoods that are next to each other (for "near X" soft matching). */
export const ADJACENT: Record<Neighborhood, Neighborhood[]> = {
  "وکیل‌آباد": ["هاشمیه", "الهیه", "قاسم‌آباد"],
  "هاشمیه": ["وکیل‌آباد", "قاسم‌آباد"],
  "الهیه": ["وکیل‌آباد", "سجاد"],
  "قاسم‌آباد": ["هاشمیه", "وکیل‌آباد"],
  "سجاد": ["احمدآباد", "الهیه"],
  "احمدآباد": ["سجاد"],
};

/** Map any spelling of a neighborhood to its canonical name, or null if unknown. */
export function canonicalNeighborhood(name: string): Neighborhood | null {
  const n = normalizeFa(name);
  for (const hood of NEIGHBORHOODS) {
    if (normalizeFa(hood) === n) return hood;
    if (ALIASES[hood].some((a) => normalizeFa(a) === n)) return hood;
  }
  return null;
}

/** All neighborhoods mentioned anywhere in free text. */
export function findNeighborhoods(text: string): Neighborhood[] {
  const t = normalizeFa(text);
  return NEIGHBORHOODS.filter(
    (hood) =>
      t.includes(normalizeFa(hood)) ||
      ALIASES[hood].some((a) => t.includes(normalizeFa(a))),
  );
}

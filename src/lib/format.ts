import { toFaDigits } from "./persian";

/** "۳ ساعت پیش", "دیروز", "۵ روز پیش". */
export function timeAgoFa(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (mins < 60) return mins <= 1 ? "همین الان" : `${toFaDigits(mins)} دقیقه پیش`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${toFaDigits(hours)} ساعت پیش`;
  const days = Math.round(hours / 24);
  if (days === 1) return "دیروز";
  if (days < 7) return `${toFaDigits(days)} روز پیش`;
  const weeks = Math.round(days / 7);
  if (weeks < 9) return weeks === 1 ? "یک هفته پیش" : `${toFaDigits(weeks)} هفته پیش`;
  return monthYearFa(iso);
}

/** "اردیبهشت ۱۴۰۳" — for older ads (the Hugging Face data is from 1403). */
export function monthYearFa(iso: string): string {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "long", year: "numeric" }).format(new Date(iso));
}

/** "طبقه ۳ از ۵", "همکف", "طبقه ۲" (when the building height is unknown). */
export function floorFa(floor: number, total: number | null): string {
  const f = floor === 0 ? "همکف" : `طبقه ${toFaDigits(floor)}`;
  return total ? `${f} از ${toFaDigits(total)}` : f;
}

export function roomsFa(rooms: number): string {
  return rooms === 0 ? "سوئیت" : `${toFaDigits(rooms)} خواب`;
}

export function ageFa(years: number): string {
  return years === 0 ? "کلیدنخورده" : years <= 2 ? "نوساز" : `${toFaDigits(years)} سال ساخت`;
}

/** "وکیل‌آباد، وکیل‌آباد ۲۶" — or just the neighborhood when the ad names no street. */
export function placeFa(l: { neighborhood: string; street: string; cityFa?: string }): string {
  const parts = [l.neighborhood, l.street].filter((x, i, a) => x && a.indexOf(x) === i && !(i && x === l.cityFa));
  return parts.join("، ");
}

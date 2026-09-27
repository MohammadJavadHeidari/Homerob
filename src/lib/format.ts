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
  return weeks === 1 ? "یک هفته پیش" : `${toFaDigits(weeks)} هفته پیش`;
}

export function roomsFa(rooms: number | undefined): string {
  if (rooms === undefined) return "خواب: نامشخص";
  return rooms === 0 ? "سوئیت" : `${toFaDigits(rooms)} خواب`;
}

/** "طبقه ۲ از ۵" / "همکف" / "طبقه ۲" — whatever the ad states. */
export function floorFa(floor: number | undefined, total: number | undefined): string {
  if (floor === undefined) return "طبقه: نامشخص";
  const f = floor === 0 ? "همکف" : `طبقه ${toFaDigits(floor)}`;
  return total ? `${f} از ${toFaDigits(total)}` : f;
}

export function ageFa(years: number | undefined): string {
  if (years === undefined) return "سن بنا: نامشخص";
  return years === 0 ? "کلیدنخورده" : years <= 2 ? "نوساز" : `${toFaDigits(years)} سال ساخت`;
}

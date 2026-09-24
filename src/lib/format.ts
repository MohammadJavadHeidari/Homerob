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

export function roomsFa(rooms: number): string {
  return rooms === 0 ? "سوئیت" : `${toFaDigits(rooms)} خواب`;
}

export function ageFa(years: number): string {
  return years === 0 ? "کلیدنخورده" : years <= 2 ? "نوساز" : `${toFaDigits(years)} سال ساخت`;
}

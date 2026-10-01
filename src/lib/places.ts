import AUTO_HOODS from "../data/auto-hoods.json";
import { normalizeFa } from "./text";

/**
 * Places Homerob knows: Iranian cities and, for cities that have listings, their neighborhoods.
 * Client-safe static data (no listings import). Real-data imports add neighborhoods here; a city
 * with at least one neighborhood counts as covered.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface CityInfo {
  fa: string;
  center: LatLng;
}

export interface HoodInfo {
  name: string;
  city: string;
  /** From OpenStreetMap (for Mashhad: same points as the home-page map pins). */
  center: LatLng;
  aliases: string[];
  /** Neighborhoods next to this one, same city (for "near X" soft matching). */
  adjacent: string[];
  /**
   * The name is also a common word or street name («دانشجو», «گاز», «انقلاب»): in free text it counts only
   * after a place word («محله دانشجو»). Exact matches (a Divar district field, a chip) are unaffected.
   */
  strict?: boolean;
}

const city = (fa: string, lat: number, lng: number): CityInfo => ({ fa, center: { lat, lng } });

/** Big Iranian cities (offline reverse geocoding + city names in queries). */
export const CITIES: CityInfo[] = [
  city("مشهد", 36.3, 59.58),
  city("تهران", 35.69, 51.39),
  city("کرج", 35.83, 50.99),
  city("اصفهان", 32.65, 51.67),
  city("شیراز", 29.61, 52.53),
  city("تبریز", 38.08, 46.29),
  city("قم", 34.64, 50.88),
  city("اهواز", 31.32, 48.67),
  city("کرمانشاه", 34.31, 47.07),
  city("ارومیه", 37.55, 45.08),
  city("رشت", 37.28, 49.58),
  city("زاهدان", 29.5, 60.86),
  city("کرمان", 30.28, 57.08),
  city("یزد", 31.9, 54.37),
  city("همدان", 34.8, 48.51),
  city("اراک", 34.09, 49.69),
  city("اردبیل", 38.25, 48.29),
  city("بندرعباس", 27.18, 56.27),
  city("قزوین", 36.27, 50.0),
  city("زنجان", 36.67, 48.48),
  city("ساری", 36.56, 53.06),
  city("گرگان", 36.84, 54.44),
  city("سنندج", 35.31, 47.0),
  city("خرم‌آباد", 33.49, 48.36),
  city("بوشهر", 28.97, 50.84),
  city("بجنورد", 37.47, 57.33),
  city("بیرجند", 32.87, 59.22),
  city("نیشابور", 36.21, 58.8),
  city("سبزوار", 36.21, 57.68),
  city("تربت حیدریه", 35.27, 59.22),
  city("قوچان", 37.11, 58.51),
  city("سمنان", 35.57, 53.39),
  city("شهرکرد", 32.33, 50.86),
  city("یاسوج", 30.67, 51.59),
  city("ایلام", 33.64, 46.42),
  city("کاشان", 33.98, 51.44),
  // Islands, the north coast and other places people rent in (holiday towns, satellite cities).
  city("کیش", 26.53, 53.98),
  city("قشم", 26.95, 56.27),
  city("چابهار", 25.29, 60.64),
  city("رامسر", 36.92, 50.64),
  city("تنکابن", 36.82, 50.87),
  city("چالوس", 36.65, 51.42),
  city("نوشهر", 36.65, 51.5),
  city("محمودآباد", 36.63, 52.26),
  city("بابلسر", 36.7, 52.65),
  city("بابل", 36.54, 52.68),
  city("آمل", 36.47, 52.35),
  city("قائم‌شهر", 36.46, 52.86),
  city("بندر انزلی", 37.47, 49.46),
  city("لاهیجان", 37.21, 50.0),
  city("لواسان", 35.82, 51.63),
  city("اسلامشهر", 35.55, 51.23),
  city("شهریار", 35.66, 51.06),
  city("ورامین", 35.32, 51.65),
  city("شاهین‌شهر", 32.86, 51.55),
  city("نجف‌آباد", 32.63, 51.37),
  city("خمینی‌شهر", 32.7, 51.52),
  city("آبادان", 30.34, 48.3),
  city("خرمشهر", 30.44, 48.18),
  city("دزفول", 32.38, 48.4),
  city("بندر ماهشهر", 30.56, 49.2),
  city("ساوه", 35.02, 50.36),
  city("شاهرود", 36.42, 54.98),
  city("گنبد کاووس", 37.25, 55.17),
  city("بروجرد", 33.9, 48.75),
  city("ملایر", 34.3, 48.82),
  city("رفسنجان", 30.4, 56.0),
  city("سیرجان", 29.45, 55.68),
  city("جیرفت", 28.68, 57.74),
  city("بم", 29.1, 58.36),
  city("مراغه", 37.39, 46.24),
  city("خوی", 38.55, 44.95),
  city("مهاباد", 36.76, 45.72),
  city("مرودشت", 29.87, 52.8),
  city("زابل", 31.03, 61.49),
  city("تربت جام", 35.24, 60.62),
  city("کاشمر", 35.24, 58.46),
  city("گناباد", 34.35, 58.68),
  city("شاندیز", 36.4, 59.3),
  city("طرقبه", 36.31, 59.37),
  city("گلبهار", 36.52, 59.21),
];

/** Other spellings, including Finglish (people type "tehran" or "kish" too). */
const CITY_ALIASES: Record<string, string[]> = {
  "تهران": ["طهران", "tehran"],
  "مشهد": ["mashhad", "mashad"],
  "اصفهان": ["اصفهون", "isfahan", "esfahan"],
  "شیراز": ["shiraz"],
  "تبریز": ["tabriz"],
  "کرج": ["karaj"],
  "قم": ["qom", "ghom"],
  "اهواز": ["ahvaz", "ahwaz"],
  "رشت": ["rasht"],
  "یزد": ["yazd"],
  "کیش": ["جزیره کیش", "kish"],
  "قشم": ["qeshm", "gheshm"],
  "خرم‌آباد": ["خرم آباد", "خرماباد"],
  "بندر انزلی": ["انزلی", "بندرانزلی"],
  "بندر ماهشهر": ["ماهشهر"],
  "گنبد کاووس": ["گنبد"],
  "بندرعباس": ["بندر عباس"],
};

const CURATED: HoodInfo[] = [
  { name: "الهیه", city: "مشهد", center: { lat: 36.3705, lng: 59.4835 }, aliases: ["الاهیه"], adjacent: ["وکیل‌آباد", "سجاد"] },
  { name: "سجاد", city: "مشهد", center: { lat: 36.3185, lng: 59.5525 }, aliases: ["بلوار سجاد", "سجاد شهر", "سجادشهر"], adjacent: ["احمدآباد", "الهیه"] },
  {
    name: "وکیل‌آباد",
    city: "مشهد",
    center: { lat: 36.3345, lng: 59.4875 },
    aliases: ["وکیل آباد", "وکیلاباد", "وکیل اباد"],
    adjacent: ["هاشمیه", "الهیه", "قاسم‌آباد", "صیاد شیرازی"],
  },
  { name: "احمدآباد", city: "مشهد", center: { lat: 36.2965, lng: 59.5755 }, aliases: ["احمد آباد", "احمداباد", "احمد اباد"], adjacent: ["سجاد"] },
  { name: "هاشمیه", city: "مشهد", center: { lat: 36.3105, lng: 59.5045 }, aliases: [], adjacent: ["وکیل‌آباد", "قاسم‌آباد", "فرهنگ"] },
  {
    name: "قاسم‌آباد",
    city: "مشهد",
    center: { lat: 36.3505, lng: 59.5055 },
    aliases: ["قاسم آباد", "قاسماباد", "قاسم اباد"],
    adjacent: ["هاشمیه", "وکیل‌آباد"],
  },
  // Added with real Divar imports (2026-09-27). Centers: OpenStreetMap / Nominatim (ODbL) district
  // points; adjacent = district centers within ~2 km. Names follow Divar's district list.
  { name: "صیاد شیرازی", city: "مشهد", center: { lat: 36.3299, lng: 59.4794 }, aliases: ["صیاد"], adjacent: ["وکیل‌آباد"] },
  { name: "فرهنگ", city: "مشهد", center: { lat: 36.3267, lng: 59.5184 }, aliases: ["بلوار فرهنگ"], adjacent: ["هاشمیه"] },
  // east Mashhad, around Mofatteh / Tabarsi
  { name: "ایثار", city: "مشهد", center: { lat: 36.2956, lng: 59.6404 }, aliases: ["مفتح"], adjacent: ["گلشور", "طلاب", "تلگرد"] },
  { name: "طلاب", city: "مشهد", center: { lat: 36.3024, lng: 59.6432 }, aliases: [], adjacent: ["ایثار", "گلشور", "تلگرد"] },
  { name: "گلشور", city: "مشهد", center: { lat: 36.2953, lng: 59.6474 }, aliases: [], adjacent: ["ایثار", "طلاب", "تلگرد"] },
  { name: "تلگرد", city: "مشهد", center: { lat: 36.2999, lng: 59.6578 }, aliases: [], adjacent: ["گلشور", "طلاب", "ایثار"] },
  {
    name: "شهرک مهرآباد",
    city: "مشهد",
    center: { lat: 36.2795, lng: 59.6625 },
    aliases: ["شهرک مهر آباد", "مهرآباد", "مهر آباد"],
    adjacent: ["پورسینا", "امیرآباد", "موعود"],
  },
  { name: "پورسینا", city: "مشهد", center: { lat: 36.2732, lng: 59.675 }, aliases: [], adjacent: ["موعود", "شهرک مهرآباد", "شهید معقول", "امیرآباد"] },
  { name: "موعود", city: "مشهد", center: { lat: 36.2662, lng: 59.679 }, aliases: [], adjacent: ["پورسینا", "شهید معقول", "امیرآباد", "شهرک مهرآباد"] },
  { name: "امیرآباد", city: "مشهد", center: { lat: 36.2649, lng: 59.6569 }, aliases: ["امیر آباد"], adjacent: ["شهید معقول", "شهرک مهرآباد", "پورسینا", "موعود"] },
  { name: "شهید معقول", city: "مشهد", center: { lat: 36.2598, lng: 59.6663 }, aliases: ["معقول"], adjacent: ["امیرآباد", "موعود", "پورسینا"] },
  // Added with the first crawler batch (2026-10-01, scripts/divar_crawler.py). Names = Divar's districts
  // ("مشکینی (شهرک غرب)" → مشکینی + the Divar spelling as an alias). Center = median of the batch's exact ad
  // points in that district (Divar's own district, not OSM's); adjacent = centers within 2 km (≤ 5).
  // strict = the name is also a common word or street name: found in a query only as «محله X» and the like.
  { name: "کوثر", city: "مشهد", center: { lat: 36.3155, lng: 59.5152 }, aliases: [], adjacent: ["هاشمیه", "هنرستان", "چهارچشمه", "فرهنگ", "نیروی هوایی"], strict: true },
  { name: "جاهد شهر", city: "مشهد", center: { lat: 36.3693, lng: 59.4724 }, aliases: ["جاهدشهر"], adjacent: ["الهیه"] },
  { name: "امیریه", city: "مشهد", center: { lat: 36.3888, lng: 59.4959 }, aliases: [], adjacent: ["امامیه"] },
  { name: "هنرستان", city: "مشهد", center: { lat: 36.3182, lng: 59.5027 }, aliases: [], adjacent: ["هاشمیه", "نیروی هوایی", "چهارچشمه", "کوثر", "فرهنگ"], strict: true },
  { name: "آزادشهر", city: "مشهد", center: { lat: 36.3319, lng: 59.5356 }, aliases: ["آزاد شهر"], adjacent: ["زیبا شهر", "شهید فرامرز عباسی", "فرهنگ", "سید رضی"] },
  { name: "سرافرازان", city: "مشهد", center: { lat: 36.2925, lng: 59.5174 }, aliases: [], adjacent: ["رضاشهر"] },
  { name: "نیروی هوایی", city: "مشهد", center: { lat: 36.3112, lng: 59.4978 }, aliases: [], adjacent: ["هاشمیه", "چهارچشمه", "هنرستان", "کوثر"] },
  { name: "مشکینی", city: "مشهد", center: { lat: 36.3677, lng: 59.5261 }, aliases: ["مشکینی (شهرک غرب)"], adjacent: ["شهرک رازی"] },
  { name: "فلسطین", city: "مشهد", center: { lat: 36.3092, lng: 59.5626 }, aliases: [], adjacent: ["ارشاد", "سجاد", "احمدآباد"], strict: true },
  { name: "رضاشهر", city: "مشهد", center: { lat: 36.2877, lng: 59.5378 }, aliases: ["رضا شهر"], adjacent: ["سرافرازان"] },
  { name: "بهمن", city: "مشهد", center: { lat: 36.3403, lng: 59.6229 }, aliases: [], adjacent: ["خواجه ربیع", "قائم", "ایثارگران"], strict: true },
  { name: "شهید فرامرز عباسی", city: "مشهد", center: { lat: 36.3331, lng: 59.5499 }, aliases: ["فرامرز عباسی", "فرامرز"], adjacent: ["زیبا شهر", "آزادشهر", "جانباز", "سجاد"] },
  { name: "جانباز", city: "مشهد", center: { lat: 36.3344, lng: 59.5661 }, aliases: [], adjacent: ["فدک", "شهید فرامرز عباسی", "ارشاد"], strict: true },
  { name: "یوسفیه", city: "مشهد", center: { lat: 36.3492, lng: 59.4743 }, aliases: ["یوسفیه (شهرک غرب)"], adjacent: ["فارغ التحصیلان", "شریف", "اقبال"] },
  { name: "زیبا شهر", city: "مشهد", center: { lat: 36.3393, lng: 59.5386 }, aliases: ["زیباشهر"], adjacent: ["آزادشهر", "شهید فرامرز عباسی", "ولیعصر", "سید رضی"] },
  { name: "شریف", city: "مشهد", center: { lat: 36.3352, lng: 59.4835 }, aliases: [], adjacent: ["وکیل‌آباد", "صیاد شیرازی", "اقبال", "فارغ التحصیلان", "تربیت"], strict: true },
  { name: "میان ولایت", city: "مشهد", center: { lat: 36.4865, lng: 59.4035 }, aliases: [], adjacent: [] },
  { name: "شاهد", city: "مشهد", center: { lat: 36.3536, lng: 59.5047 }, aliases: ["شاهد (شهرک غرب)"], adjacent: ["قاسم‌آباد", "ولیعصر", "دانشجو", "تربیت"], strict: true },
  { name: "سیس‌آباد", city: "مشهد", center: { lat: 36.3395, lng: 59.6507 }, aliases: ["سیس آباد", "سیسآباد"], adjacent: ["همت آباد", "خواجه ربیع", "قائم"] },
  { name: "هفده شهریور", city: "مشهد", center: { lat: 36.272, lng: 59.6158 }, aliases: [], adjacent: ["کارگران", "مقدم"] },
  { name: "ارشاد", city: "مشهد", center: { lat: 36.3177, lng: 59.5721 }, aliases: [], adjacent: ["فلسطین", "سجاد", "جانباز"], strict: true },
  { name: "چهارچشمه", city: "مشهد", center: { lat: 36.3083, lng: 59.5058 }, aliases: [], adjacent: ["هاشمیه", "نیروی هوایی", "هنرستان", "کوثر"] },
  { name: "دانشجو", city: "مشهد", center: { lat: 36.3376, lng: 59.5093 }, aliases: [], adjacent: ["سید رضی", "تربیت", "فرهنگ", "قاسم‌آباد", "ولیعصر"], strict: true },
  { name: "شهرک رازی", city: "مشهد", center: { lat: 36.3587, lng: 59.5355 }, aliases: ["شهرک رازی (شهرک غرب)"], adjacent: ["مشکینی", "ولیعصر", "حضرت حجت"] },
  { name: "گاز", city: "مشهد", center: { lat: 36.3218, lng: 59.6273 }, aliases: [], adjacent: ["فاطمیه", "قائم", "سمزقند", "هنرور", "خواجه ربیع"], strict: true },
  { name: "اقبال", city: "مشهد", center: { lat: 36.3325, lng: 59.4731 }, aliases: [], adjacent: ["فارغ التحصیلان", "صیاد شیرازی", "شریف", "وکیل‌آباد", "یوسفیه"], strict: true },
  { name: "طبرسی شمالی", city: "مشهد", center: { lat: 36.3258, lng: 59.674 }, aliases: [], adjacent: ["شهید قربانی", "رده"] },
  { name: "حسین‌آباد", city: "مشهد", center: { lat: 36.288, lng: 59.6473 }, aliases: ["حسین آباد"], adjacent: ["گلشور", "ایثار", "تلگرد", "طلاب", "شهرک مهرآباد"] },
  { name: "سید رضی", city: "مشهد", center: { lat: 36.3341, lng: 59.5172 }, aliases: [], adjacent: ["دانشجو", "فرهنگ", "ولیعصر", "آزادشهر", "تربیت"], strict: true },
  { name: "انصار", city: "مشهد", center: { lat: 36.2596, lng: 59.6855 }, aliases: [], adjacent: ["موعود", "شهید معقول", "پورسینا"], strict: true },
  { name: "فارغ التحصیلان", city: "مشهد", center: { lat: 36.3374, lng: 59.4716 }, aliases: ["فارغ‌التحصیلان"], adjacent: ["اقبال", "صیاد شیرازی", "شریف", "یوسفیه", "وکیل‌آباد"] },
  { name: "فدک", city: "مشهد", center: { lat: 36.3426, lng: 59.5777 }, aliases: [], adjacent: ["جانباز"], strict: true },
  { name: "ابوذر", city: "مشهد", center: { lat: 36.3101, lng: 59.6555 }, aliases: [], adjacent: ["تلگرد", "رده", "طلاب", "گلشور"], strict: true },
  { name: "خواجه ربیع", city: "مشهد", center: { lat: 36.3382, lng: 59.6343 }, aliases: [], adjacent: ["قائم", "بهمن", "سیس‌آباد", "گاز"] },
  { name: "باغون آباد", city: "مشهد", center: { lat: 36.4075, lng: 59.4926 }, aliases: ["باغون‌آباد"], adjacent: [] },
  { name: "سناباد", city: "مشهد", center: { lat: 36.2954, lng: 59.5963 }, aliases: [], adjacent: ["بهشت", "احمدآباد"] },
  { name: "کارمندان دوم", city: "مشهد", center: { lat: 36.264, lng: 59.6431 }, aliases: [], adjacent: ["امیرآباد", "کارگران"] },
  { name: "شترک", city: "مشهد", center: { lat: 36.3194, lng: 59.7239 }, aliases: [], adjacent: [] },
  { name: "ایمان", city: "مشهد", center: { lat: 36.2501, lng: 59.5912 }, aliases: [], adjacent: ["خرمشهر", "مقدم"], strict: true },
  { name: "کارگران", city: "مشهد", center: { lat: 36.2678, lng: 59.6232 }, aliases: [], adjacent: ["هفده شهریور", "مقدم", "کارمندان دوم"], strict: true },
  { name: "قائم", city: "مشهد", center: { lat: 36.3289, lng: 59.6358 }, aliases: [], adjacent: ["خواجه ربیع", "گاز", "فاطمیه", "بهمن", "سیس‌آباد"], strict: true },
  { name: "امیر المومنین", city: "مشهد", center: { lat: 36.2999, lng: 59.6854 }, aliases: ["امیرالمومنین"], adjacent: [], strict: true },
  { name: "ایثارگران", city: "مشهد", center: { lat: 36.332, lng: 59.6043 }, aliases: [], adjacent: ["هنرور", "بهمن", "سمزقند"], strict: true },
  { name: "شهید قربانی", city: "مشهد", center: { lat: 36.3252, lng: 59.6756 }, aliases: [], adjacent: ["طبرسی شمالی", "رده"], strict: true },
  { name: "توس فردوسی", city: "مشهد", center: { lat: 36.4814, lng: 59.5195 }, aliases: [], adjacent: [] },
  { name: "رده", city: "مشهد", center: { lat: 36.3137, lng: 59.6686 }, aliases: [], adjacent: ["ابوذر", "شهید قربانی", "طبرسی شمالی", "تلگرد"], strict: true },
  { name: "بهشت", city: "مشهد", center: { lat: 36.2953, lng: 59.5816 }, aliases: [], adjacent: ["احمدآباد", "کوه سنگی", "سناباد"], strict: true },
  { name: "هنرور", city: "مشهد", center: { lat: 36.3219, lng: 59.607 }, aliases: [], adjacent: ["سمزقند", "ایثارگران", "گاز", "فاطمیه"], strict: true },
  { name: "فاطمیه", city: "مشهد", center: { lat: 36.3166, lng: 59.6278 }, aliases: [], adjacent: ["گاز", "سمزقند", "قائم", "هنرور"], strict: true },
  { name: "کلاته برفی", city: "مشهد", center: { lat: 36.4459, lng: 59.4695 }, aliases: [], adjacent: [] },
  { name: "سمزقند", city: "مشهد", center: { lat: 36.3167, lng: 59.616 }, aliases: [], adjacent: ["هنرور", "فاطمیه", "گاز", "ایثارگران"] },
  { name: "حضرت حجت", city: "مشهد", center: { lat: 36.3636, lng: 59.5562 }, aliases: [], adjacent: ["نوده", "شهرک رازی"], strict: true },
  { name: "خرمشهر", city: "مشهد", center: { lat: 36.2667, lng: 59.5938 }, aliases: [], adjacent: ["مقدم", "ایمان"], strict: true },
  { name: "انقلاب", city: "مشهد", center: { lat: 36.225, lng: 59.6184 }, aliases: [], adjacent: [], strict: true },
  { name: "همت آباد", city: "مشهد", center: { lat: 36.3491, lng: 59.6619 }, aliases: ["همت‌آباد"], adjacent: ["سیس‌آباد"] },
  { name: "امامیه", city: "مشهد", center: { lat: 36.3727, lng: 59.5035 }, aliases: ["امامیه (شهرک غرب)"], adjacent: ["الهیه", "امیریه"], strict: true },
  { name: "تربیت", city: "مشهد", center: { lat: 36.338, lng: 59.4977 }, aliases: ["تربیت (صدف)"], adjacent: ["وکیل‌آباد", "دانشجو", "شریف", "قاسم‌آباد", "سید رضی"], strict: true },
  { name: "مقدم", city: "مشهد", center: { lat: 36.2597, lng: 59.6094 }, aliases: [], adjacent: ["هفده شهریور", "کارگران", "خرمشهر", "ایمان"], strict: true },
  { name: "آبادگران", city: "مشهد", center: { lat: 36.2656, lng: 59.5403 }, aliases: [], adjacent: [], strict: true },
  { name: "ولیعصر", city: "مشهد", center: { lat: 36.3474, lng: 59.5226 }, aliases: ["ولیعصر (شهرک غرب)"], adjacent: ["سید رضی", "قاسم‌آباد", "دانشجو", "زیبا شهر", "شهرک رازی"], strict: true },
  { name: "نوده", city: "مشهد", center: { lat: 36.3761, lng: 59.5484 }, aliases: [], adjacent: ["حضرت حجت"], strict: true },
  { name: "کوه سنگی", city: "مشهد", center: { lat: 36.2872, lng: 59.5759 }, aliases: ["کوهسنگی"], adjacent: ["احمدآباد", "بهشت"] },
];

/**
 * Districts the crawl import registered on its own (`npm run import:divar-crawl -- … --auto-hoods`,
 * src/lib/import/auto-hoods.ts): center = median of the ads' exact points, `strict` unless the name is
 * clearly a place name. Curated entries above win; move an entry up there once it has been checked.
 */
export const HOODS: HoodInfo[] = [
  ...CURATED,
  ...(AUTO_HOODS as HoodInfo[]).filter((a) => !CURATED.some((c) => c.city === a.city && c.name === a.name)),
];

/** Adjacency is symmetric: a neighbor listed on either side counts for both. */
export function linkAdjacent(hoods: HoodInfo[] = HOODS): void {
  for (const h of hoods) {
    for (const a of h.adjacent) {
      const other = hoods.find((x) => x.name === a && x.city === h.city);
      if (other && !other.adjacent.includes(h.name)) other.adjacent.push(h.name);
    }
  }
}
linkAdjacent();

/** Cities that have neighborhoods (and so listings). */
export const COVERED_CITIES: string[] = [...new Set(HOODS.map((h) => h.city))];

export const isCovered = (c: string | null | undefined) => !!c && COVERED_CITIES.includes(c);

export function cityInfo(name: string): CityInfo | undefined {
  return CITIES.find((c) => c.fa === name);
}

export function hoodsIn(c: string): HoodInfo[] {
  return HOODS.filter((h) => h.city === c);
}

/** Neighborhood by canonical name (optionally within a city — names can repeat across cities). */
export function hoodInfo(name: string, inCity?: string | null): HoodInfo | undefined {
  return HOODS.find((h) => h.name === name && (!inCity || h.city === inCity));
}

export function cityOfHood(name: string, inCity?: string | null): string | null {
  return hoodInfo(name, inCity)?.city ?? null;
}

export function adjacentHoods(name: string, inCity?: string | null): string[] {
  return hoodInfo(name, inCity)?.adjacent ?? [];
}

/** Map point for a neighborhood; the city center when the neighborhood isn't in the registry. */
export function hoodCenter(name: string, inCity?: string | null): LatLng | null {
  return hoodInfo(name, inCity)?.center ?? (inCity ? (cityInfo(inCity)?.center ?? null) : null);
}

const spellings = (h: HoodInfo) => [h.name, ...h.aliases].map(normalizeFa);

/** Words that mark the next word as a place («محله دانشجو», «منطقه گاز»). */
const PLACE_WORDS = ["محله", "محله ی", "محله‌ی", "محلهٔ", "منطقه", "منطقه ی", "منطقه‌ی", "شهرک", "کوی", "بلوار", "خیابان"];

/** Spellings to look for in free text: strict names only after a place word. */
export function textSpellings(h: HoodInfo): string[] {
  const names = [h.name, ...h.aliases];
  return h.strict ? names.flatMap((n) => PLACE_WORDS.map((w) => `${w} ${n}`)) : names;
}

/** Map any spelling of a neighborhood to its canonical name, or null if unknown. */
export function canonicalNeighborhood(name: string, inCity?: string | null): string | null {
  const n = normalizeFa(name);
  return HOODS.find((h) => (!inCity || h.city === inCity) && spellings(h).includes(n))?.name ?? null;
}

/** All neighborhoods mentioned anywhere in free text (within `inCity` when given). */
export function findNeighborhoods(text: string, inCity?: string | null): string[] {
  const t = normalizeFa(text);
  return HOODS.filter((h) => (!inCity || h.city === inCity) && textSpellings(h).some((s) => t.includes(normalizeFa(s)))).map(
    (h) => h.name,
  );
}

const cityWords = (c: CityInfo) => [c.fa, ...(CITY_ALIASES[c.fa] ?? [])];

/**
 * Text form used for place matching: normalized, lower-case, «آ» as «ا» (people type both), and
 * ZWNJ / no space / space treated alike ("وکیل‌آباد" = "وکیل آباد" = "وکیلاباد").
 */
const loose = (s: string) => normalizeFa(s).toLowerCase().replace(/آ/g, "ا");

/**
 * Whole-word pattern for a place name ("قم", not the "قم" inside "رقم"). Spaces inside the name are
 * optional, so a joined spelling still matches.
 */
export function placePattern(name: string): RegExp {
  const body = loose(name)
    .split(" ")
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(" ?");
  // letters (and marks) of any script are word characters; «،» and «؟» are not
  return new RegExp(`(?<![\\p{L}\\p{M}])${body}(?![\\p{L}\\p{M}])`, "gu");
}

/** Every whole-word hit of a place name in text (index in the `loose` form of the text). */
export function placeHits(text: string, name: string): number[] {
  return [...loose(text).matchAll(placePattern(name))].map((m) => m.index);
}

/** Canonical city name for any spelling, or null. */
export function canonicalCity(name: string): string | null {
  const n = loose(name).replace(/^(شهر|جزیره|استان) /, "");
  return CITIES.find((c) => cityWords(c).some((w) => loose(w) === n))?.fa ?? null;
}

/**
 * City name to search by: the canonical one when known, else the name as written (so a query for a
 * city we don't list yet gets "no listings from X yet", not another city's listings). Not a city → null.
 */
export function cityName(name: string | null | undefined): string | null {
  if (!name) return null;
  const known = canonicalCity(name);
  if (known) return known;
  const n = normalizeFa(name).replace(/^(شهر|جزیره|استان) /, "");
  return /^[\p{Script=Arabic} ]{2,24}$/u.test(n) && !/^(ایران|کل ایران|همه جا)$/.test(n) ? n : null;
}

/** Every city named in free text, in reading order. */
export function citiesIn(text: string): { fa: string; at: number }[] {
  const t = loose(text);
  const hits: { fa: string; at: number }[] = [];
  for (const c of CITIES) {
    const at = Math.min(...cityWords(c).flatMap((w) => placeHits(t, w)));
    if (Number.isFinite(at)) hits.push({ fa: c.fa, at });
  }
  return hits.sort((a, b) => a.at - b.at);
}

/**
 * The city the user wants to live in: the first one named, except one they are moving away from
 * ("از تهران میام مشهد" → مشهد) when another city is named too.
 */
export function findCity(text: string): string | null {
  const t = loose(text);
  const hits = citiesIn(t);
  const from = (h: { at: number }) => /(?:^|\s)از\s?$/.test(t.slice(Math.max(0, h.at - 4), h.at));
  return (hits.find((h) => !from(h)) ?? hits[0])?.fa ?? null;
}

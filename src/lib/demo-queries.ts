/** Example queries: shown as clickable chips in the UI and used for manual testing. */
export const DEMO_QUERIES = [
  "یه آپارتمان دوخوابه نزدیک وکیل‌آباد با ۵۰۰ میلیون رهن",
  "سوئیت یا یک‌خوابه تو سجاد، ماهی حداکثر ۸ تومن",
  "خونه پارکینگ‌دار در احمدآباد برای خانواده ۳ نفره",
  "رهن کامل تا یک و نیم میلیارد، هاشمیه یا وکیل‌آباد",
  "پونصد تومن پول پیش دارم و ماهی ۱۵ تومن می‌تونم اجاره بدم، قاسم‌آباد",
  "رهن ۳۰۰ اجاره ۱۰، دوخوابه با آسانسور",
  "یه جای نوساز و مبله برای یه زوج جوان، الهیه، ترجیحاً نزدیک قطار شهری",
  "حدود ۱۲۰ متر سه‌خوابه با پارکینگ و انباری، بودجه ۲ میلیارد",
  "دانشجوام، یه سوئیت ارزون هر جای مشهد، ماهی ۵ تومن",
  "دوخوابه بالکن‌دار سجاد، پارکینگ مهم نیست، رهن ۴۰۰ میلیون",
] as const;

/**
 * Home-page chips: short, the way people really type (docs/research/landing-ux.md) — three is
 * enough. Each must parse with the rule fallback too and return results.
 */
export const HERO_EXAMPLES = ["دوخوابه وکیل‌آباد ۵۰۰ رهن", "سوئیت سجاد ماهی ۸ تومن", "رهن کامل تا یک و نیم میلیارد هاشمیه"] as const;

/** Example queries for manual testing — all return results on the real data (src/data/divar.json). */
export const DEMO_QUERIES = [
  // docs/DEMO_SCRIPT.md, in order
  "دوخوابه مفتح رهن کامل تا ۱.۵ میلیارد",
  "دوخوابه وکیل‌آباد با ۵۰۰ میلیون رهن",
  "خونه ویلایی پورسینا رهن ۲۰۰ ماهی ۱۰ تومن",
  // backup / extra
  "یک خوابه گلشور ماهی ۱۵ تومن",
  "سه خوابه وکیل‌آباد رهن ۷۰۰ اجاره ۱۰",
  "آپارتمان با آسانسور و پارکینگ نزدیک مفتح، رهن کامل تا ۲ میلیارد",
  "خونه حیاط‌دار شرق مشهد، رهن ۱۰۰ ماهی ۱۰ تومن",
] as const;

/**
 * Short chips, the way people really type (docs/research/landing-ux.md). Not on the home page since
 * the "logo + search only" landing; kept for tests and future use. Each must parse with the rule
 * fallback too and return results.
 */
export const HERO_EXAMPLES = ["دوخوابه مفتح رهن کامل", "ویلایی پورسینا ۲۰۰ رهن", "دوخوابه وکیل‌آباد ۵۰۰ رهن"] as const;

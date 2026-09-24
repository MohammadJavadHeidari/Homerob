// Generates src/data/listings.json — realistic, deterministic sample rental listings for Mashhad.
// Run: node scripts/generate-listings.mjs
// Prices are Toman (2026 levels). Seeded RNG → same output every run.

import { writeFileSync } from "node:fs";

const RATE = 0.03; // keep in sync with MONTHLY_RATE in src/lib/pricing.ts
const NOW = new Date("2026-09-24T12:00:00+03:30");
const PER_NEIGHBORHOOD = 15;

// ---------- seeded RNG ----------
let seed = 20260924;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (a, b) => a + rand() * (b - a);
const int = (a, b) => Math.floor(between(a, b + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;
function weighted(pairs) {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of pairs) if ((r -= w) < 0) return v;
  return pairs[pairs.length - 1][0];
}
function sample(arr, n) {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  return out;
}

const fa = (n) => String(n).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
const roundTo = (v, step) => Math.round(v / step) * step;

// ---------- neighborhoods ----------
// ppm = full-deposit-equivalent price per m² (Toman), [min, max].
const HOODS = {
  "الهیه": {
    ppm: [17e6, 22e6],
    streets: ["بلوار الهیه", "الهیه ۸", "الهیه ۱۲", "الهیه ۲۴", "بلوار معلم", "نبش الهیه ۱۶"],
    rooms: [[1, 2], [2, 4], [3, 3], [4, 1]],
    metro: 0.1,
    newish: 0.5,
  },
  "سجاد": {
    ppm: [14e6, 18e6],
    streets: ["بلوار سجاد", "بزرگمهر شمالی", "حامد جنوبی", "خیابان خیام", "میدان ارشاد", "بلوار سجاد، نبش منظریه"],
    rooms: [[0, 1], [1, 3], [2, 5], [3, 2]],
    metro: 0.35,
    newish: 0.3,
  },
  "وکیل‌آباد": {
    ppm: [12e6, 16e6],
    streets: ["بلوار وکیل‌آباد", "وکیل‌آباد ۱۵", "وکیل‌آباد ۲۶", "وکیل‌آباد ۳۴", "نزدیک پارک ملت", "بلوار دانشجو"],
    rooms: [[0, 1], [1, 3], [2, 5], [3, 2]],
    metro: 0.55,
    newish: 0.35,
  },
  "احمدآباد": {
    ppm: [13e6, 17e6],
    streets: ["خیابان احمدآباد", "خیابان عارف", "خیابان رضا", "خیابان پرستار", "خیابان قائم", "خیابان عدل"],
    rooms: [[1, 3], [2, 5], [3, 3]],
    metro: 0.4,
    newish: 0.15,
  },
  "هاشمیه": {
    ppm: [11e6, 14e6],
    streets: ["بلوار هاشمیه", "هاشمیه ۳۰", "هاشمیه ۴۲", "هاشمیه ۶۴", "هاشمیه ۸۱", "بلوار هاشمیه، نبش ۵۶"],
    rooms: [[0, 1], [1, 3], [2, 5], [3, 2]],
    metro: 0.15,
    newish: 0.35,
  },
  "قاسم‌آباد": {
    ppm: [8e6, 11e6],
    streets: ["بلوار امامیه", "بلوار شریعتی", "بلوار حجاب", "بلوار فلاحی", "بلوار اندیشه", "امامیه ۲۲"],
    rooms: [[0, 1], [1, 4], [2, 5], [3, 2]],
    metro: 0.45,
    newish: 0.2,
  },
};

const AREA_BY_ROOMS = { 0: [35, 50], 1: [52, 78], 2: [80, 125], 3: [125, 175], 4: [175, 240] };
const ROOM_WORD = { 0: "سوئیت", 1: "یک‌خوابه", 2: "دوخوابه", 3: "سه‌خوابه", 4: "چهارخوابه" };

// ---------- one listing ----------
function makeListing(hood, idx) {
  const cfg = HOODS[hood];
  const rooms = weighted(cfg.rooms);
  const [amin, amax] = AREA_BY_ROOMS[rooms];
  const areaM2 = int(amin, amax);
  const buildingAge = chance(cfg.newish) ? int(0, 4) : weighted([[int(5, 10), 5], [int(11, 18), 3], [int(19, 30), 1]]);
  const totalFloors = rooms >= 3 && chance(0.5) ? int(6, 12) : int(3, 7);
  const floor = int(rooms === 0 && chance(0.4) ? 0 : 1, totalFloors);
  const elevator = totalFloors >= 5 ? chance(0.95) : chance(0.35);
  const parking = rooms === 0 ? chance(0.35) : buildingAge < 12 ? chance(0.9) : chance(0.55);
  const storage = rooms === 0 ? chance(0.2) : chance(buildingAge < 12 ? 0.85 : 0.5);

  const tags = [];
  if (buildingAge <= 2) tags.push("نوساز");
  else if (buildingAge >= 15 && chance(0.5)) tags.push("بازسازی‌شده");
  if (chance(0.55)) tags.push("بالکن");
  if (chance(cfg.metro)) tags.push("نزدیک قطار شهری");
  if (rooms <= 1 && chance(0.35)) tags.push("مبله");
  if (floor <= 1 && chance(0.35)) tags.push("حیاط اختصاصی");
  if (floor === totalFloors && totalFloors >= 6 && chance(0.5)) tags.push("پنت‌هاوس");
  if (totalFloors >= 7 && chance(0.6)) tags.push("لابی‌من");
  if (buildingAge <= 5 && totalFloors >= 6 && chance(0.4)) tags.push(pick(["استخر و سونا", "روف‌گاردن", "سالن اجتماعات"]));
  if (chance(0.4)) tags.push(pick(["کولر گازی", "پکیج", "آیفون تصویری", "کابینت های‌گلاس", "نورگیر عالی"]));

  // price: full-deposit equivalent
  let ppm = between(...cfg.ppm);
  if (buildingAge <= 2) ppm *= 1.12;
  else if (buildingAge >= 19) ppm *= 0.8;
  else if (buildingAge >= 11) ppm *= 0.9;
  if (parking) ppm *= 1.04;
  if (elevator) ppm *= 1.03;
  if (tags.includes("مبله")) ppm *= 1.1;
  ppm *= between(0.93, 1.07); // listing noise → some good deals, some overpriced
  const full = ppm * areaM2;

  // split into deposit + rent
  const mode = weighted([["full-rahn", 15], ["mixed", 78], ["mostly-rent", 7]]);
  let deposit, monthlyRent;
  if (mode === "full-rahn") {
    deposit = roundTo(full, 50e6);
    monthlyRent = 0;
  } else {
    const share = mode === "mostly-rent" ? between(0.05, 0.12) : between(0.2, 0.65);
    deposit = Math.max(50e6, roundTo(full * share, full * share > 300e6 ? 50e6 : 10e6));
    monthlyRent = roundTo((full - deposit) * RATE * between(0.95, 1.05), 500e3);
  }

  const source = chance(0.6) ? "divar" : "sheypoor";
  const street = pick(cfg.streets);
  const convertible = mode !== "full-rahn" ? chance(0.7) : chance(0.5);
  const postedAt = new Date(NOW.getTime() - between(0.05, 21) * 864e5).toISOString();

  return {
    id: `${source === "divar" ? "dv" : "sp"}-${String(1000 + idx)}`,
    source,
    title: makeTitle({ source, rooms, areaM2, hood, tags, monthlyRent }),
    neighborhood: hood,
    street,
    deposit,
    monthlyRent,
    areaM2,
    rooms,
    floor,
    totalFloors,
    buildingAge,
    elevator,
    parking,
    storage,
    tags,
    convertible,
    description: makeDescription({ rooms, floor, totalFloors, buildingAge, elevator, parking, storage, tags, convertible, monthlyRent }),
    postedAt,
  };
}

function makeTitle({ source, rooms, areaM2, hood, tags, monthlyRent }) {
  const a = fa(areaM2);
  const kind = ROOM_WORD[rooms];
  const flair = tags.includes("نوساز") ? " نوساز" : tags.includes("مبله") ? " مبله" : tags.includes("پنت‌هاوس") ? " پنت‌هاوس" : "";
  if (rooms === 0) return `سوئیت ${a} متری${flair} ${hood}`;
  if (source === "sheypoor") {
    const verb = monthlyRent === 0 ? "رهن کامل" : "رهن و اجاره";
    return pick([`${verb} آپارتمان ${a} متری ${kind} در ${hood}`, `آپارتمان ${a} متر ${kind}${flair} - ${hood}`]);
  }
  if (monthlyRent === 0) return pick([`رهن کامل ${a} متری ${kind} ${hood}`, `${a} متر ${kind} رهن کامل ${hood}`]);
  return pick([
    `آپارتمان ${a} متری ${kind}${flair} ${hood}`,
    `${a} متر ${fa(rooms)} خواب${flair} ${hood}`,
    `${kind} ${a} متری ${pick(["فول امکانات", "خوش‌نقشه", "دنج", "نورگیر"])} ${hood}`,
  ]);
}

function makeDescription({ rooms, floor, totalFloors, buildingAge, elevator, parking, storage, tags, convertible, monthlyRent }) {
  const parts = [];
  const floorText = floor === 0 ? "همکف" : `طبقه ${fa(floor)} از ${fa(totalFloors)}`;
  const ageText = buildingAge === 0 ? "کلید‌نخورده" : buildingAge <= 2 ? "نوساز" : `${fa(buildingAge)} سال ساخت`;
  parts.push(`${floorText}، ${ageText}.`);

  const amen = [elevator && "آسانسور", parking && "پارکینگ اختصاصی", storage && "انباری"].filter(Boolean);
  if (amen.length) parts.push(`دارای ${amen.join("، ").replace(/، ([^،]*)$/, " و $1")}.`);
  const missing = [!parking && "پارکینگ", !elevator && totalFloors >= 4 && "آسانسور"].filter(Boolean);
  if (missing.length && chance(0.7)) parts.push(`${missing.join(" و ")} ندارد.`);

  const interior = sample(
    ["کف سرامیک", "کف پارکت", "کابینت ممبران", "کابینت های‌گلاس", "کمد دیواری", "دیوارها تازه رنگ‌شده", "پنجره دوجداره", "سرویس ایرانی و فرنگی", "آشپزخانه اپن", "حمام و دستشویی جدا"],
    int(2, 4),
  );
  parts.push(`${interior.join("، ")}.`);

  const extras = tags.filter((t) => !["نوساز", "مبله"].includes(t));
  if (extras.length) parts.push(`${extras.join("، ")}.`);
  if (tags.includes("مبله")) parts.push("به‌صورت مبله با یخچال، گاز و مبلمان تحویل داده می‌شود.");

  parts.push(rooms <= 1 ? pick(["مناسب زوج جوان.", "مناسب دانشجو یا زوج جوان.", "مناسب زوج یا مجرد شاغل."]) : pick(["مناسب خانواده.", "فقط به خانواده.", "مناسب خانواده کم‌جمعیت."]));

  if (monthlyRent === 0) parts.push(convertible ? "رهن کامل، قابل تبدیل به رهن و اجاره." : "فقط رهن کامل.");
  else parts.push(convertible ? pick(["رهن و اجاره قابل جابجایی.", "مبلغ قابل تبدیل است.", "امکان افزایش رهن و کاهش اجاره هست."]) : pick(["مبلغ ثابت، قابل تبدیل نیست.", "رهن و اجاره ثابت است."]));

  parts.push(pick(["مالک هستم، مشاور نیستم.", "بازدید با هماهنگی.", "لطفاً فقط تماس بگیرید.", "حیوان خانگی ممنوع.", "تخلیه از اول ماه آینده.", "آماده تحویل."]));
  return parts.join(" ");
}

// ---------- hand-crafted demo listings ----------
// Anchor listings for the demo story: "2-bed near Vakilabad with 500M rahn".
const HERO = [
  {
    id: "dv-0901", source: "divar", title: "آپارتمان ۹۵ متری دوخوابه وکیل‌آباد", neighborhood: "وکیل‌آباد", street: "وکیل‌آباد ۲۶",
    deposit: 450e6, monthlyRent: 18e6, areaM2: 95, rooms: 2, floor: 3, totalFloors: 5, buildingAge: 6,
    elevator: true, parking: false, storage: true, tags: ["بالکن", "نزدیک قطار شهری"], convertible: true,
    description: "طبقه ۳ از ۵، ۶ سال ساخت. دارای آسانسور و انباری. پارکینگ ندارد. کف سرامیک، کابینت های‌گلاس، آشپزخانه اپن. بالکن، نزدیک قطار شهری. مناسب خانواده. رهن و اجاره قابل جابجایی. مالک هستم، مشاور نیستم.",
    postedAt: "2026-09-23T18:20:00.000Z",
  },
  {
    id: "sp-0902", source: "sheypoor", title: "رهن و اجاره آپارتمان ۱۰۵ متری دوخوابه در وکیل‌آباد", neighborhood: "وکیل‌آباد", street: "بلوار وکیل‌آباد",
    deposit: 550e6, monthlyRent: 16e6, areaM2: 105, rooms: 2, floor: 4, totalFloors: 6, buildingAge: 3,
    elevator: true, parking: true, storage: true, tags: ["بالکن", "پکیج", "نزدیک قطار شهری"], convertible: true,
    description: "طبقه ۴ از ۶، ۳ سال ساخت. دارای آسانسور، پارکینگ اختصاصی و انباری. کف پارکت، کمد دیواری، پنجره دوجداره. بالکن، پکیج، نزدیک قطار شهری. مناسب خانواده. امکان افزایش رهن و کاهش اجاره هست. بازدید با هماهنگی.",
    postedAt: "2026-09-24T07:10:00.000Z",
  },
  {
    id: "dv-0903", source: "divar", title: "۸۸ متر ۲ خواب خوش‌نقشه وکیل‌آباد", neighborhood: "وکیل‌آباد", street: "وکیل‌آباد ۱۵",
    deposit: 500e6, monthlyRent: 12e6, areaM2: 88, rooms: 2, floor: 2, totalFloors: 4, buildingAge: 14,
    elevator: false, parking: true, storage: false, tags: ["بازسازی‌شده"], convertible: false,
    description: "طبقه ۲ از ۴، ۱۴ سال ساخت. دارای پارکینگ اختصاصی. آسانسور ندارد. دیوارها تازه رنگ‌شده، کابینت ممبران، سرویس ایرانی و فرنگی. بازسازی‌شده. فقط به خانواده. مبلغ ثابت، قابل تبدیل نیست. لطفاً فقط تماس بگیرید.",
    postedAt: "2026-09-21T15:40:00.000Z",
  },
  {
    id: "dv-0904", source: "divar", title: "آپارتمان ۱۱۰ متری دوخوابه نوساز وکیل‌آباد", neighborhood: "وکیل‌آباد", street: "نزدیک پارک ملت",
    deposit: 700e6, monthlyRent: 20e6, areaM2: 110, rooms: 2, floor: 5, totalFloors: 8, buildingAge: 1,
    elevator: true, parking: true, storage: true, tags: ["نوساز", "بالکن", "لابی‌من", "روف‌گاردن"], convertible: true,
    description: "طبقه ۵ از ۸، نوساز. دارای آسانسور، پارکینگ اختصاصی و انباری. کف پارکت، کابینت های‌گلاس، پنجره دوجداره. بالکن، لابی‌من، روف‌گاردن. مناسب خانواده. رهن و اجاره قابل جابجایی. آماده تحویل.",
    postedAt: "2026-09-22T09:00:00.000Z",
  },
  {
    // Same apartment as dv-0901 posted on Sheypoor too (for the stretch "dedup" story).
    id: "sp-0905", source: "sheypoor", title: "آپارتمان ۹۵ متر دوخوابه - وکیل‌آباد", neighborhood: "وکیل‌آباد", street: "وکیل‌آباد ۲۶",
    deposit: 450e6, monthlyRent: 18e6, areaM2: 95, rooms: 2, floor: 3, totalFloors: 5, buildingAge: 6,
    elevator: true, parking: false, storage: true, tags: ["بالکن", "نزدیک قطار شهری"], convertible: true,
    description: "واحد طبقه سوم، ۹۵ متر، دو خواب. آسانسور و انباری دارد، پارکینگ ندارد. نزدیک ایستگاه قطار شهری. رهن و اجاره قابل جابجایی. مالک.",
    postedAt: "2026-09-23T20:05:00.000Z",
  },
  {
    id: "dv-0906", source: "divar", title: "رهن کامل ۹۰ متری دوخوابه هاشمیه", neighborhood: "هاشمیه", street: "هاشمیه ۴۲",
    deposit: 1_100e6, monthlyRent: 0, areaM2: 90, rooms: 2, floor: 2, totalFloors: 5, buildingAge: 8,
    elevator: true, parking: true, storage: true, tags: ["بالکن"], convertible: true,
    description: "طبقه ۲ از ۵، ۸ سال ساخت. دارای آسانسور، پارکینگ اختصاصی و انباری. کف سرامیک، کمد دیواری، آشپزخانه اپن. بالکن. مناسب خانواده. رهن کامل، قابل تبدیل به رهن و اجاره. بازدید با هماهنگی.",
    postedAt: "2026-09-20T11:30:00.000Z",
  },
  // Data-quality cases: placeholder ("توافقی") prices and shared rooms — must not pollute ranking.
  {
    id: "dv-0907", source: "divar", title: "آپارتمان ۱۱۰ متری دوخوابه وکیل‌آباد - توافقی", neighborhood: "وکیل‌آباد", street: "وکیل‌آباد ۳۴",
    deposit: 1_000, monthlyRent: 1_000, areaM2: 110, rooms: 2, floor: 2, totalFloors: 5, buildingAge: 4,
    elevator: true, parking: true, storage: true, tags: ["بالکن"], convertible: true,
    description: "طبقه ۲ از ۵، ۴ سال ساخت. دارای آسانسور، پارکینگ اختصاصی و انباری. رهن و اجاره توافقی، برای قیمت تماس بگیرید.",
    postedAt: "2026-09-23T10:15:00.000Z",
  },
  {
    id: "sp-0908", source: "sheypoor", title: "رهن و اجاره آپارتمان ۹۰ متری دوخوابه در هاشمیه", neighborhood: "هاشمیه", street: "هاشمیه ۶۴",
    deposit: 1_111_111, monthlyRent: 111_111, areaM2: 90, rooms: 2, floor: 3, totalFloors: 4, buildingAge: 9,
    elevator: false, parking: true, storage: true, tags: [], convertible: true,
    description: "واحد ۹۰ متری دو خواب، طبقه سوم. قیمت واقعی نیست، مبلغ پس از بازدید توافق می‌شود.",
    postedAt: "2026-09-22T16:40:00.000Z",
  },
  {
    id: "dv-0909", source: "divar", title: "اجاره اتاق در واحد دوخوابه، همخونه خانم - سجاد", neighborhood: "سجاد", street: "بلوار سجاد",
    deposit: 30e6, monthlyRent: 4e6, areaM2: 85, rooms: 2, floor: 3, totalFloors: 5, buildingAge: 7,
    elevator: true, parking: false, storage: false, tags: ["مبله"], convertible: false,
    description: "یک اتاق مبله در واحد دوخوابه، آشپزخانه و سرویس مشترک. فقط همخونه خانم دانشجو یا شاغل. قبوض تقسیم می‌شود.",
    postedAt: "2026-09-24T05:30:00.000Z",
  },
  {
    id: "sp-0910", source: "sheypoor", title: "هم‌خونه آقا، اتاق مبله نزدیک قطار شهری - قاسم‌آباد", neighborhood: "قاسم‌آباد", street: "بلوار امامیه",
    deposit: 20e6, monthlyRent: 3.5e6, areaM2: 75, rooms: 2, floor: 1, totalFloors: 4, buildingAge: 12,
    elevator: false, parking: false, storage: false, tags: ["مبله", "نزدیک قطار شهری"], convertible: false,
    description: "اجاره اتاق در واحد ۷۵ متری، هم‌خونه آقا. اینترنت و قبوض نصف. مناسب دانشجو.",
    postedAt: "2026-09-23T21:10:00.000Z",
  },
];

// ---------- build ----------
const listings = [...HERO];
let idx = 0;
for (const hood of Object.keys(HOODS)) {
  for (let i = 0; i < PER_NEIGHBORHOOD; i++) listings.push(makeListing(hood, idx++));
}
listings.sort((a, b) => b.postedAt.localeCompare(a.postedAt));

writeFileSync(new URL("../src/data/listings.json", import.meta.url), JSON.stringify(listings, null, 2) + "\n");
console.log(`wrote ${listings.length} listings`);

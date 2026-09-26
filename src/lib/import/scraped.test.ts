import { describe, expect, it } from "vitest";

import { csvRecords, parsePostedAt, parseToman, rowToListing } from "./scraped";

const now = new Date("2026-09-26T12:00:00Z");

describe("parseToman", () => {
  it("reads Persian digits, separators and units", () => {
    expect(parseToman("۲۰۰٬۰۰۰٬۰۰۰ تومان")).toBe(200_000_000);
    expect(parseToman("۱٫۲ میلیارد")).toBe(1_200_000_000);
    expect(parseToman("500 میلیون")).toBe(500_000_000);
    expect(parseToman("رایگان")).toBe(0);
    expect(parseToman("توافقی")).toBeNull();
  });
});

describe("parsePostedAt", () => {
  it("reads relative Persian times", () => {
    expect(parsePostedAt("۳ ساعت پیش در سجاد", now)).toBe("2026-09-26T09:00:00.000Z");
    expect(parsePostedAt("دیروز", now)).toBe("2026-09-25T12:00:00.000Z");
    expect(parsePostedAt("هفته پیش", now)).toBe("2026-09-19T12:00:00.000Z");
    expect(parsePostedAt("فوری", now)).toBeNull();
  });
});

describe("csv + rowToListing", () => {
  it("parses a Divar list-card export with unknown column names", () => {
    const csv = [
      "kt-post-card__title,kt-post-card__description,kt-post-card__description 2,kt-post-card__bottom-description,href,image",
      '"آپارتمان ۸۵ متری دوخوابه، آسانسور و پارکینگ","ودیعه: ۲۰۰٬۰۰۰٬۰۰۰ تومان","اجارهٔ ماهانه: ۱۰٬۰۰۰٬۰۰۰ تومان","۲ روز پیش در سجاد",https://divar.ir/v/apartment/wZ3kQx9a,https://s100.divarcdn.com/static/photo/a.jpg',
      '"رهن کامل ۱۲۰ متر هاشمیه","ودیعه: ۱٫۵ میلیارد تومان","","لحظاتی پیش در هاشمیه",https://divar.ir/v/rahn/AbCdEf12,',
      '"اجاره ۹۰ متری طبقه ۲","ودیعه: توافقی","","دیروز در سجاد",https://divar.ir/v/x/ZZZZZZ99,',
      '"آپارتمان در طلاب","ودیعه: ۱۰۰ میلیون","اجاره: ۵ میلیون","دیروز در طلاب",https://divar.ir/v/x/YYYYYY88,',
    ].join("\n");
    const recs = csvRecords(csv);
    expect(recs).toHaveLength(4);

    const a = rowToListing(recs[0], { now });
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.value.listing).toMatchObject({
      id: "dv-wZ3kQx9a",
      source: "divar",
      neighborhood: "سجاد",
      deposit: 200_000_000,
      monthlyRent: 10_000_000,
      areaM2: 85,
      rooms: 2,
      elevator: true,
      parking: true,
      storage: false,
      url: "https://divar.ir/v/apartment/wZ3kQx9a",
      imageUrl: "https://s100.divarcdn.com/static/photo/a.jpg",
      postedAt: "2026-09-24T12:00:00.000Z",
    });
    expect(a.value.guessed).toEqual(["floor", "buildingAge"]);

    const b = rowToListing(recs[1], { now });
    expect(b.ok && b.value.listing).toMatchObject({ deposit: 1_500_000_000, monthlyRent: 0, areaM2: 120, neighborhood: "هاشمیه" });

    expect(rowToListing(recs[2], { now })).toEqual({ ok: false, reason: "no-price" });
    expect(rowToListing(recs[3], { now })).toEqual({ ok: false, reason: "no-neighborhood" });
  });

  it("uses header columns from a single-ad page export and file fallbacks", () => {
    const [rec] = csvRecords(
      "عنوان,متراژ,سال ساخت,اتاق,طبقه,آسانسور,پارکینگ,انباری,ودیعه,اجاره\n" +
        "سوئیت نوساز,۵۵,۱۴۰۲,۱,۳ از ۵,دارد,ندارد,دارد,۳۰۰ میلیون,۸ میلیون",
    );
    const r = rowToListing(rec, { now, fallbackNeighborhood: "الهیه", fallbackSource: "sheypoor" });
    expect(r.ok && r.value.listing).toMatchObject({
      source: "sheypoor",
      neighborhood: "الهیه",
      areaM2: 55,
      buildingAge: 3,
      rooms: 1,
      floor: 3,
      totalFloors: 5,
      elevator: true,
      parking: false,
      storage: true,
      deposit: 300_000_000,
      monthlyRent: 8_000_000,
    });
    expect(r.ok && r.value.guessed).toEqual(["postedAt"]);
  });
});

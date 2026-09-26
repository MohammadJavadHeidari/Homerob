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

  describe("per-ad Divar export (data/raw/*-divar.csv format)", () => {
    const HEADER = "عنوان,محله,ودیعه,اجاره,متراژ,اتاق,طبقه,سال ساخت,آسانسور,پارکینگ,انباری,توضیحات,زمان,link,image";
    const row = (cells: Partial<Record<string, string>>) => {
      const base: Record<string, string> = {
        عنوان: "آپارتمان ۱۰۰ متری",
        محله: "الهیه",
        ودیعه: "۹۰۰٬۰۰۰٬۰۰۰ تومان",
        اجاره: "۳٬۰۰۰٬۰۰۰ تومان",
        متراژ: "۱۰۰",
        اتاق: "۲",
        طبقه: "۳ از ۵",
        "سال ساخت": "۱۳۹۸",
        آسانسور: "دارد",
        پارکینگ: "دارد",
        انباری: "ندارد",
        توضیحات: "",
        زمان: "۲ ساعت پیش",
        link: "https://divar.ir/v/gaTest01",
        image: "",
        ...cells,
      };
      const line = HEADER.split(",").map((h) => `"${(base[h] ?? "").replace(/"/g, '""')}"`).join(",");
      return csvRecords(`${HEADER}\r\n${line}\r\n`)[0];
    };

    it("prefers the neighborhood column over areas named in the description", () => {
      const r = rowToListing(row({ توضیحات: "نزدیک وکیل‌آباد و سجادیه ۳۲\nبالکن" }), { now });
      expect(r.ok && r.value.listing.neighborhood).toBe("الهیه");
    });

    it("uses the file's neighborhood when Divar's district name isn't one of ours", () => {
      const rec = row({ محله: "هنرستان", عنوان: "۱۹۰ متری / هفت تیر / وکیل آباد و پیروزی" });
      const r = rowToListing(rec, { now, fallbackNeighborhood: "هاشمیه" });
      expect(r.ok && r.value.listing.neighborhood).toBe("هاشمیه");
    });

    it("keeps a real description even when it mentions prices", () => {
      const desc = "۱۰۵ متر | دو خواب\nرهن کامل: ۹۰۰ میلیون تومان\nتراس و پکیج";
      const r = rowToListing(row({ توضیحات: desc }), { now });
      expect(r.ok && r.value.listing.description).toBe(desc);
      expect(r.ok && r.value.listing.tags).toEqual(expect.arrayContaining(["بالکن", "پکیج"]));
    });

    it("treats a symbolic rent on a full-rahn ad as zero", () => {
      const r = rowToListing(row({ ودیعه: "۸۵۰٬۰۰۰٬۰۰۰ تومان", اجاره: "۱٬۰۰۰ تومان" }), { now });
      expect(r.ok && r.value.listing).toMatchObject({ deposit: 850_000_000, monthlyRent: 0 });
    });

    it("skips implausible floor areas (typos, storage units)", () => {
      expect(rowToListing(row({ متراژ: "۴۰۴۰" }), { now })).toEqual({ ok: false, reason: "implausible-area" });
      expect(rowToListing(row({ متراژ: "۱۲" }), { now })).toEqual({ ok: false, reason: "implausible-area" });
    });

    it("tags split ACs written without a space", () => {
      const r = rowToListing(row({ توضیحات: "کولرگازی\nپکیج" }), { now });
      expect(r.ok && r.value.listing.tags).toContain("کولر گازی");
    });

    it("skips roommate-style placeholder prices", () => {
      expect(rowToListing(row({ ودیعه: "۱٬۰۰۰ تومان", اجاره: "۱۰٬۰۰۰ تومان" }), { now })).toEqual({
        ok: false,
        reason: "placeholder-price",
      });
    });

    it("reads «میلیارد» with a Persian-style decimal point and «رایگان» rent", () => {
      const r = rowToListing(row({ ودیعه: "۱.۵۰۰ میلیارد تومان", اجاره: "رایگان", طبقه: "همکف از ۲" }), { now });
      expect(r.ok && r.value.listing).toMatchObject({ deposit: 1_500_000_000, monthlyRent: 0, floor: 0, totalFloors: 2 });
      expect(r.ok && r.value.guessed).toEqual([]);
    });
  });
});

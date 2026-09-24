import { describe, expect, it } from "vitest";

import { parseIntentWithRules as parse } from "./rules";

const M = 1_000_000;

describe("rule-based intent parser", () => {
  it("parses the flagship demo query", () => {
    const i = parse("یه آپارتمان دوخوابه نزدیک وکیل‌آباد با ۵۰۰ میلیون رهن");
    expect(i.maxDeposit).toBe(500 * M);
    expect(i.maxRent).toBeNull();
    expect(i.minRooms).toBe(2);
    expect(i.neighborhoods).toEqual(["وکیل‌آباد"]);
  });

  it("understands colloquial rent in تومن", () => {
    const i = parse("سوئیت یا یک‌خوابه تو سجاد، ماهی حداکثر ۸ تومن");
    expect(i.maxRent).toBe(8 * M);
    expect(i.minRooms).toBe(0);
    expect(i.maxRooms).toBe(1);
    expect(i.neighborhoods).toEqual(["سجاد"]);
  });

  it("handles number words and میلیارد", () => {
    expect(parse("رهن کامل یک و نیم میلیارد").maxDeposit).toBe(1_500 * M);
    expect(parse("رهن کامل یک و نیم میلیارد").maxRent).toBe(0);
    expect(parse("پونصد میلیون پول پیش و ماهی بیست تومن").maxDeposit).toBe(500 * M);
    expect(parse("پونصد میلیون پول پیش و ماهی بیست تومن").maxRent).toBe(20 * M);
    expect(parse("صد و پنجاه میلیون رهن").maxDeposit).toBe(150 * M);
  });

  it("handles Latin and Persian digits and bare amounts", () => {
    expect(parse("رهن 300 میلیون اجاره 10 میلیون").maxDeposit).toBe(300 * M);
    const bare = parse("رهن ۳۰۰ اجاره ۱۰ هاشمیه");
    expect(bare.maxDeposit).toBe(300 * M);
    expect(bare.maxRent).toBe(10 * M);
    expect(parse("رهن ۱.۵").maxDeposit).toBe(1_500 * M);
  });

  it("infers deposit vs rent from magnitude when there is no keyword", () => {
    const i = parse("بودجه ام ۸۰۰ میلیونه، قاسم آباد");
    expect(i.maxDeposit).toBe(800 * M);
    expect(i.neighborhoods).toEqual(["قاسم‌آباد"]);
  });

  it("separates must-have from nice-to-have amenities", () => {
    const i = parse("دوخوابه با پارکینگ و آسانسور، ترجیحا بالکن داشته باشه");
    expect(i.mustHave).toEqual(expect.arrayContaining(["parking", "elevator"]));
    expect(i.niceToHave).toContain("balcony");
    expect(i.mustHave).not.toContain("balcony");
  });

  it("ignores amenities the user says don't matter", () => {
    const i = parse("سوئیت مبله، پارکینگ مهم نیست");
    expect(i.mustHave).toContain("furnished");
    expect(i.mustHave).not.toContain("parking");
  });

  it("infers rooms from family size", () => {
    const i = parse("خونه پارکینگ‌دار در احمدآباد برای خانواده ۳ نفره");
    expect(i.minRooms).toBe(2);
    expect(i.freeTextNotes).toBe("خانواده 3 نفره");
    expect(i.mustHave).toContain("parking");
    expect(i.neighborhoods).toEqual(["احمدآباد"]);
  });

  it("parses area and multiple neighborhoods", () => {
    const i = parse("حدود ۱۰۰ متر، الهیه یا هاشمیه");
    expect(i.minArea).toBe(85);
    expect(i.neighborhoods).toEqual(expect.arrayContaining(["الهیه", "هاشمیه"]));
  });

  it("returns an empty intent for gibberish", () => {
    const i = parse("سلام");
    expect(i.maxDeposit).toBeNull();
    expect(i.neighborhoods).toEqual([]);
    expect(i.mustHave).toEqual([]);
  });
});

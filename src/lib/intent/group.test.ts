import { describe, expect, it } from "vitest";

import { detectGroup } from "./group";
import { parseIntentWithRules as parse } from "./rules";

const M = 1_000_000;

describe("group renting («نفری چقدر؟»)", () => {
  it("reads the group size in the ways people say it", () => {
    expect(detectGroup("4 تا دانشجوییم").people).toBe(4);
    expect(detectGroup("3 نفریم").people).toBe(3);
    expect(detectGroup("3 نفر هم خونه").people).toBe(3);
    expect(detectGroup("با 2 تا دوستم دنبال خونه ایم").people).toBe(3);
    expect(detectGroup("با هم اتاقیم").people).toBe(2);
    expect(detectGroup("دوخوابه وکیل آباد").people).toBeNull();
    expect(detectGroup("خانواده 4 نفریم").people).toBeNull();
  });

  it("tells a per-person budget from «the four of us»", () => {
    expect(detectGroup("نفری 150 میلیون").perPerson).toBe(true);
    expect(detectGroup("هر نفر ماهی 3 تومن").perPerson).toBe(true);
    expect(detectGroup("4 نفری 600 میلیون داریم").perPerson).toBe(false);
    expect(detectGroup("4 نفریم").perPerson).toBe(false);
  });

  it("turns a per-person budget into the group's total", () => {
    const i = parse("چهار تا دانشجوییم، نفری ۱۵۰ میلیون رهن و ماهی ۳ تومن");
    expect(i.people).toBe(4);
    expect(i.maxDeposit).toBe(600 * M);
    expect(i.maxRent).toBe(12 * M);
    expect(i.minRooms).toBe(2); // about two per bedroom
  });

  it("keeps a group total as is, and a stated room count", () => {
    const i = parse("سه نفریم، سه خوابه با ۹۰۰ میلیون رهن");
    expect(i.people).toBe(3);
    expect(i.maxDeposit).toBe(900 * M);
    expect(i.minRooms).toBe(3);
  });

  it("ignores a group outside home rentals", () => {
    expect(parse("ویلا برای آخر هفته، ۴ نفریم، شبی ۲ میلیون").people).toBeNull();
  });
});

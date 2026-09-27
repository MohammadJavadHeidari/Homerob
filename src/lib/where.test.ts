import { describe, expect, it } from "vitest";

import { applyPlace, resolvePlace } from "./intent/place";
import { EMPTY_INTENT } from "./intent/schema";
import { canonicalCity, cityName, findCity } from "./places";
import { detectPlace } from "./where";

describe("detectPlace", () => {
  it("reads a named city, including ones without listings yet", () => {
    expect(detectPlace("یه سوئیت مبله تو کیش برای ۶ ماه")).toEqual({ status: "found", city: "کیش", area: null, via: "city" });
    expect(detectPlace("دوخوابه در تهران، رهن ۲ میلیارد")).toMatchObject({ city: "تهران", via: "city" });
    expect(detectPlace("apartment in Kish")).toMatchObject({ city: "کیش" });
  });

  it("infers the city from a neighborhood or landmark", () => {
    expect(detectPlace("دوخوابه نزدیک وکیل آباد ۵۰۰ رهن")).toMatchObject({ city: "مشهد", area: "وکیل‌آباد", via: "area" });
    expect(detectPlace("سوئیت سعادتاباد")).toMatchObject({ city: "تهران", area: "سعادت‌آباد", via: "area" });
    expect(detectPlace("خونه نزدیک حرم امام رضا")).toMatchObject({ city: "مشهد", via: "area" });
    expect(detectPlace("یه واحد تو گوهردشت")).toMatchObject({ city: "کرج" });
  });

  it("asks when a name exists in more than one city", () => {
    expect(detectPlace("آپارتمان الهیه")).toEqual({ status: "ambiguous", area: "الهیه", cities: ["مشهد", "تهران"] });
    expect(detectPlace("آپارتمان الهیه تهران")).toMatchObject({ status: "found", city: "تهران", area: "الهیه" });
    // a second, unambiguous place settles it
    expect(detectPlace("الهیه یا ونک")).toMatchObject({ status: "found", city: "تهران" });
    // the city named in the text wins
    expect(detectPlace("ستارخان شیراز")).toMatchObject({ city: "شیراز", area: "ستارخان", via: "city" });
  });

  it("says so when the text names no place", () => {
    expect(detectPlace("دوخوابه ۵۰۰ رهن")).toEqual({ status: "none" });
  });

  it("does not see places inside other words", () => {
    expect(detectPlace("رقم رهن ۵۰۰").status).toBe("none");
    expect(detectPlace("کیشمیشی").status).toBe("none");
  });
});

describe("city names", () => {
  it("prefers the city they move to over the one they leave", () => {
    expect(findCity("از تهران دارم میام مشهد")).toBe("مشهد");
    expect(findCity("تهران")).toBe("تهران");
  });

  it("canonicalizes prefixed and Finglish names", () => {
    expect(canonicalCity("جزیره کیش")).toBe("کیش");
    expect(canonicalCity("شهر شیراز")).toBe("شیراز");
    expect(canonicalCity("Tehran")).toBe("تهران");
  });
});

describe("applyPlace (server)", () => {
  const base = { ...EMPTY_INTENT };
  it("a city named in the text beats the LLM's guess", () => {
    expect(applyPlace({ ...base, city: "مشهد" }, detectPlace("سوئیت کیش")).city).toBe("کیش");
  });
  it("fills a city the LLM missed from a landmark, keeps the LLM's otherwise", () => {
    expect(applyPlace(base, detectPlace("نزدیک سعادت آباد")).city).toBe("تهران");
    expect(applyPlace({ ...base, city: "تهران" }, detectPlace("نزدیک برج آزادی")).city).toBe("تهران");
    expect(applyPlace(base, detectPlace("الهیه")).city).toBeNull();
  });
  it("keeps a city we don't list yet instead of dropping it", () => {
    expect(cityName("ماکو")).toBe("ماکو");
    expect(cityName("ایران")).toBeNull();
    expect(resolvePlace({ ...base, city: "ماکو" }).city).toBe("ماکو");
  });
});

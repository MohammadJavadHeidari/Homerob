import { describe, expect, it } from "vitest";

import { campusById, campusDistance, campusDistanceFa, findCampus, kmToCampus } from "./campuses";
import { parseIntentWithRules as parse } from "./intent/rules";

const ferdowsi = campusById("ferdowsi")!;

describe("campuses («تا دانشگاه چقدر راهه؟»)", () => {
  it("finds the university a query names, not a street with the same name", () => {
    expect(findCampus("خونه نزدیک دانشگاه فردوسی")?.id).toBe("ferdowsi");
    expect(findCampus("دانشجوی علوم پزشکی ام")?.id).toBe("mums");
    expect(findCampus("نزدیک دانشگاه آزاد")?.id).toBe("azad");
    expect(findCampus("خیابان فردوسی")).toBeNull();
    expect(findCampus("بلوار خیام")).toBeNull();
  });

  it("measures to the campus edge: 0 inside, grows outside", () => {
    expect(kmToCampus({ lat: 36.309, lng: 59.528 }, ferdowsi)).toBe(0);
    const west = kmToCampus({ lat: 36.3084, lng: 59.4945 }, ferdowsi); // ~2.2 km west of the western edge
    expect(west).toBeGreaterThan(1.8);
    expect(west).toBeLessThan(2.6);
  });

  it("says how it measured: the ad's point, or roughly from the neighborhood", () => {
    const exact = campusDistance({ lat: 36.3084, lng: 59.505, neighborhood: "هاشمیه", city: "مشهد" }, ferdowsi)!;
    expect(exact.exact).toBe(true);
    expect(exact.walkMin).not.toBeNull();
    expect(campusDistanceFa(exact)).not.toContain("حدود");
    const rough = campusDistance({ neighborhood: "پورسینا", city: "مشهد" }, ferdowsi)!;
    expect(rough.exact).toBe(false);
    expect(rough.km % 0.5).toBe(0);
    expect(rough.walkMin).toBeNull();
    expect(campusDistanceFa(rough)).toMatch(/^حدود .* کیلومتر تا دانشگاه فردوسی$/);
  });

  it("puts the campus (and its city) into the intent", () => {
    const i = parse("دوخوابه نزدیک دانشگاه فردوسی");
    expect(i.campus).toBe("ferdowsi");
    expect(i.city).toBe("مشهد");
  });
});

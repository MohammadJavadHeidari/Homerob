import { describe, expect, it } from "vitest";

import { EMPTY_INTENT, type SearchIntent } from "@/lib/intent/schema";
import { toFaDigits } from "@/lib/persian";
import { search } from "@/lib/search";
import { fixture } from "@/test/fixtures";

import { accessText, applyMetroText, findMetroLines, metroAccess, metroLinesIn, nearLines, shouldAskLine, withMetroLines } from "./metro";

const intent = (p: Partial<SearchIntent>): SearchIntent => ({ ...EMPTY_INTENT, ...p });

// real station positions (OSM, src/data/metro.json), a few steps off
const nearSadaf = fixture("dv-sadaf", { lat: 36.3305, lng: 59.4935 }); // خط ۱، صدف
const nearNabovvat = fixture("dv-nabovvat", { neighborhood: "گلشور", lat: 36.3065, lng: 59.645 }); // خط ۲، نبوت
const farAway = fixture("dv-far", { neighborhood: "پورسینا", lat: 36.2732, lng: 59.675 });

describe("metro data", () => {
  it("has Mashhad's three lines in service, with named stations", () => {
    const lines = metroLinesIn("مشهد");
    expect(lines.map((l) => l.ref)).toEqual(["1", "2", "3"]);
    expect(lines[0].from).toBe("وکیل‌آباد");
    for (const l of lines) for (const s of l.stations) expect(s.n).not.toBe("");
    expect(metroLinesIn("کیش")).toEqual([]);
  });
});

describe("metroAccess", () => {
  it("finds the nearest station of each line within a walk", () => {
    const [a] = metroAccess(nearSadaf);
    expect(a.line.ref).toBe("1");
    expect(a.station.n).toBe("صدف");
    expect(a.minutes).toBeLessThanOrEqual(3);
    expect(accessText(a)).toBe(`${toFaDigits(a.minutes)} دقیقه پیاده تا ایستگاه صدف (خط ۱)`);
    expect(nearLines(nearNabovvat, ["2"])?.station.n).toBe("نبوت");
    expect(nearLines(nearNabovvat, ["1"])).toBeNull();
    expect(metroAccess(farAway)).toEqual([]);
  });

  it("says «حدود» when the ad has no exact position", () => {
    const approx = fixture("dv-approx", { neighborhood: "صیاد شیرازی" });
    const [a] = metroAccess(approx);
    expect(a.exact).toBe(false);
    expect(accessText(a)).toMatch(/^حدود /);
  });
});

describe("findMetroLines", () => {
  it.each([
    ["خونه نزدیک مترو خط ۱", ["1"]],
    ["نزدیک خط دو مترو", ["2"]],
    ["خط یک و سه مترو", ["1", "3"]],
    ["مترو خطوط 1 و 2", ["1", "2"]],
    ["نزدیک مترو", []],
    ["خط تلفن داشته باشه", []],
    ["خط ۵ مترو", []], // Mashhad has no line 5 in service
  ])("%s → %j", (q, refs) => {
    expect(findMetroLines(q, "مشهد")).toEqual(refs);
  });
});

describe("metro in search", () => {
  const all = [nearSadaf, nearNabovvat, farAway];

  it("asks which line when the metro is wanted and the city has several", () => {
    expect(shouldAskLine(intent({ mustHave: ["nearMetro"] }), "مشهد")).toBe(true);
    expect(shouldAskLine(intent({ niceToHave: ["nearMetro"] }), "مشهد")).toBe(true);
    expect(shouldAskLine(intent({ mustHave: ["nearMetro"], metroLines: ["1"] }), "مشهد")).toBe(false);
    expect(shouldAskLine(intent({}), "مشهد")).toBe(false);
    expect(shouldAskLine(intent({ mustHave: ["nearMetro"] }), "کیش")).toBe(false);
  });

  it("keeps only homes near the chosen lines and names the station", () => {
    const { results } = search(withMetroLines(intent({ city: "مشهد", niceToHave: ["nearMetro"] }), ["2"]), all, Infinity);
    expect(results.map((r) => r.listing.id)).toEqual(["dv-nabovvat"]);
    expect(results[0].highlights.some((h) => h.kind === "pro" && h.text.includes("ایستگاه نبوت (خط ۲)"))).toBe(true);
  });

  it("uses real distance for «نزدیک مترو» without a line", () => {
    const { results } = search(intent({ city: "مشهد", mustHave: ["nearMetro"] }), all, Infinity);
    const byId = new Map(results.map((r) => [r.listing.id, r]));
    expect(byId.get("dv-sadaf")!.score).toBeGreaterThan(byId.get("dv-far")!.score);
    expect(byId.get("dv-far")!.highlights.some((h) => h.kind === "con")).toBe(true);
  });

  it("reads the line from the text and makes it a must", () => {
    const next = applyMetroText(intent({ city: "مشهد", niceToHave: ["nearMetro"] }), "دوخوابه نزدیک خط ۱ مترو");
    expect(next.metroLines).toEqual(["1"]);
    expect(next.mustHave).toContain("nearMetro");
    expect(next.niceToHave).not.toContain("nearMetro");
  });
});

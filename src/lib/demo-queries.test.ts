import { describe, expect, it } from "vitest";

import { DEMO_QUERIES, HERO_EXAMPLES } from "./demo-queries";
import { resolvePlace } from "./intent/place";
import { parseIntentWithRules } from "./intent/rules";
import { search } from "./search";

describe("demo queries", () => {
  it("all return real results with the rule parser alone", () => {
    for (const q of [...DEMO_QUERIES, ...HERO_EXAMPLES]) {
      expect(search(resolvePlace(parseIntentWithRules(q))).total, q).toBeGreaterThan(0);
    }
  });
});

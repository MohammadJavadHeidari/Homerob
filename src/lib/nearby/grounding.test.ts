import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { grounded } = await import("./index");

describe("nearby grounding", () => {
  const facts = new Set(["2", "6"]); // «۲ دقیقه», «۶ دقیقه»

  it("accepts minutes taken from the place's own facts", () => {
    expect(grounded("ایستگاه مترو صدف، ۲ دقیقه پیاده", facts)).toBe(true);
  });

  it("rejects any other number, even a small one", () => {
    expect(grounded("سوپرمارکت، ۱ دقیقه پیاده", facts)).toBe(false);
    expect(grounded("۳ ایستگاه اتوبوس", facts)).toBe(false);
  });
});

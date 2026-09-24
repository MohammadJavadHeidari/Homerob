import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { numbersAreGrounded } = await import("./index");

describe("numbersAreGrounded", () => {
  const facts = { pros: ["۱۲۰ میلیون زیر بودجه‌ات", "ماهی ۲٫۵ میلیون کمتر از سقف اجاره‌ات"], area: "۹۵ متر" };

  it("accepts numbers copied from the facts", () => {
    expect(numbersAreGrounded("۱۲۰ میلیون زیر بودجه‌ته و ۹۵ متره", facts)).toBe(true);
    expect(numbersAreGrounded("ماهی ۲٫۵ میلیون کمتر می‌دی", facts)).toBe(true);
  });

  it("allows small counts like room numbers", () => {
    expect(numbersAreGrounded("۲ خوابه‌ست", facts)).toBe(true);
  });

  it("rejects invented numbers", () => {
    expect(numbersAreGrounded("۱۲۰۰ میلیون زیر بودجه‌ته", facts)).toBe(false);
    expect(numbersAreGrounded("فقط ۳۰ میلیون اجاره", facts)).toBe(false);
  });
});

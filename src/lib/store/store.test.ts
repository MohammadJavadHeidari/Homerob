import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { clientUrl } = await import("./index");

describe("clientUrl", () => {
  it("drops libpq-only options from Neon URLs but keeps sslmode", () => {
    const u = clientUrl("postgresql://u:p@ep-x-pooler.neon.tech/neondb?channel_binding=require&sslmode=require");
    expect(u).toBe("postgresql://u:p@ep-x-pooler.neon.tech/neondb?sslmode=require");
  });
});

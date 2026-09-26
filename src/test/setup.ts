import { vi } from "vitest";

// Tests rank a frozen, hand-checked fixture (the former seeded sample), not the live scraped data,
// so their expectations don't change every time new listings are imported.
vi.mock("@/data/listings", async () => ({
  listings: (await import("./fixtures/listings.json")).default,
}));

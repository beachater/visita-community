import { describe, expect, it } from "vitest";
import { TIER3_ENABLED, TIER3_ROUTES } from "./routes.mjs";

// Paths are relative to this file. Vite lists them at test time, no Node fs needed.
const tier3Pages = Object.keys(import.meta.glob("./*.astro"));
const routedPages = Object.keys(import.meta.glob("../pages/**/*"));
const shipped = import.meta.glob<string>(["../**/*.{astro,ts,tsx,mjs}", "!./**", "!../**/*.test.{ts,tsx}"], {
  query: "?raw",
  import: "default",
  eager: true,
});

describe("Tier 3 routes (BEA-5)", () => {
  it("are off for v1", () => expect(TIER3_ENABLED).toBe(false));

  it("each point at a page in src/tier3", () => {
    for (const r of TIER3_ROUTES) expect(tier3Pages, r.entrypoint).toContain(r.entrypoint.replace("./src/tier3/", "./"));
  });

  it("have no page left in src/pages, so the flag is the only way in", () => {
    const leftovers = routedPages.filter((p) =>
      /^\.\.\/pages\/(community|referrals|vouchers|check-in|r)([./]|$)|^\.\.\/pages\/cafe\/[^/]+\/verify\./.test(p));
    expect(leftovers).toEqual([]);
  });

  it("have no links from shipped code", () => {
    const link = /["'`](\/community|\/referrals|\/vouchers|\/check-in\/|\/r\/)|\/verify["'`]/;
    const offenders = Object.entries(shipped).filter(([, src]) => link.test(src)).map(([path]) => path);
    expect(Object.keys(shipped).length).toBeGreaterThan(50);
    expect(offenders).toEqual([]);
  });
});

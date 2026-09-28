import { describe, expect, it } from "vitest";
import { formatDistance, haversineMeters } from "./distance";

describe("haversineMeters", () => {
  it("is zero for the same point", () => expect(haversineMeters({ lat: 8.48, lng: 124.64 }, { lat: 8.48, lng: 124.64 })).toBe(0));
  it("measures Gaston Park to USTP (about 1.9 km)", () => {
    const m = haversineMeters({ lat: 8.475474, lng: 124.642131 }, { lat: 8.485859, lng: 124.655834 });
    expect(m).toBeGreaterThan(1_800);
    expect(m).toBeLessThan(2_000);
  });
});

describe("formatDistance", () => {
  it.each([
    [4, "10 m away"],
    [347, "350 m away"],
    [1_234, "1.2 km away"],
    [12_400, "12 km away"],
  ])("%d m → %s", (m, expected) => expect(formatDistance(m)).toBe(expected));
});

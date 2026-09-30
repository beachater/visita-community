import { describe, expect, it } from "vitest";
import { currentOccupancy, setAgo } from "./occupancy";

const now = new Date("2026-10-01T10:00:00Z");
const row = (setMinutesAgo: number, level: "quiet" | "moderate" | "full" = "moderate") => ({
  level,
  set_at: new Date(now.getTime() - setMinutesAgo * 60_000).toISOString(),
  expires_at: new Date(now.getTime() + (180 - setMinutesAgo) * 60_000).toISOString(),
});

describe("currentOccupancy", () => {
  it("shows a fresh status", () => expect(currentOccupancy(row(20), now)).toEqual({ level: "moderate", ago: "20 min ago" }));
  it("hides it once it expires", () => expect(currentOccupancy(row(181), now)).toBeNull());
  it("hides it exactly at expiry", () => expect(currentOccupancy(row(180), now)).toBeNull());
  it("shows nothing when there is no status", () => expect(currentOccupancy(null, now)).toBeNull());
});

describe("setAgo", () => {
  it.each([
    [0, "just now"],
    [0.5, "just now"],
    [1, "1 min ago"],
    [59, "59 min ago"],
    [60, "1 hr ago"],
    [150, "2 hr ago"],
  ])("%d minutes → %s", (m, text) => expect(setAgo(new Date(now.getTime() - m * 60_000).toISOString(), now)).toBe(text));
});

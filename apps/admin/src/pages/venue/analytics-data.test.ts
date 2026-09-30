import { describe, expect, it } from "vitest";
import { compact, fillDays, heatGrid, rangeFor, share } from "./analytics-data";

describe("rangeFor", () => {
  it("covers the last N days up to now", () => {
    const now = new Date("2026-10-01T04:00:00Z");
    const r = rangeFor(7, now);
    expect(r.to).toBe("2026-10-01T04:00:00.000Z");
    expect(r.from).toBe("2026-09-24T04:00:00.000Z");
  });
});

describe("heatGrid", () => {
  it("lays views out by weekday (Mon first) and hour, with the busiest cell", () => {
    const g = heatGrid([
      { dow: 1, hour: 11, count: 2 },
      { dow: 7, hour: 19, count: 5 },
    ]);
    expect(g.rows).toHaveLength(7);
    expect(g.rows[0]).toHaveLength(24);
    expect(g.rows[0]![11]).toBe(2);
    expect(g.rows[6]![19]).toBe(5);
    expect(g.rows[3]![3]).toBe(0);
    expect(g.max).toBe(5);
  });
  it("has no maximum when there's no data", () => expect(heatGrid([]).max).toBe(0));
});

describe("fillDays", () => {
  it("fills days without activity with zeros, in Manila dates", () => {
    const out = fillDays([{ day: "2026-09-29", profile_view: 3, walkthrough_open: 1, directions_tap: 0 }], rangeFor(3, new Date("2026-10-01T04:00:00Z")));
    expect(out.map((d) => d.day)).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"]);
    expect(out[1]).toEqual({ day: "2026-09-29", profile_view: 3, walkthrough_open: 1, directions_tap: 0 });
    expect(out[0]!.profile_view).toBe(0);
  });
});

describe("compact / share", () => {
  it.each([
    [0, "0"],
    [999, "999"],
    [1284, "1,284"],
    [12_900, "12.9K"],
    [4_200_000, "4.2M"],
  ])("%d → %s", (n, s) => expect(compact(n)).toBe(s));
  it("shows a share as a whole percent, or a dash when there's nothing to divide", () => {
    expect(share(0.2517)).toBe("25%");
    expect(share(null)).toBe("–");
  });
});

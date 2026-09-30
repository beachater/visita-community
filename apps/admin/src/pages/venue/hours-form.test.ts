import { describe, expect, it } from "vitest";
import type { WeeklyHours } from "@visita/shared-types";
import { hoursFromRows, rowsFromHours, type DayRow } from "./hours-form";

describe("hours editor round-trip", () => {
  it("turns stored hours into one row per day, unknown days included", () => {
    const rows = rowsFromHours({ mon: ["08:00", "20:00"], sun: null });
    expect(rows).toHaveLength(7);
    expect(rows[0]).toMatchObject({ day: "mon", state: "open", opens: "08:00", closes: "20:00", overnight: false });
    expect(rows[1]).toMatchObject({ day: "tue", state: "unknown" });
    expect(rows[6]).toMatchObject({ day: "sun", state: "closed" });
  });
  it("marks a span past midnight as overnight", () =>
    expect(rowsFromHours({ fri: ["18:00", "02:00"] })[4]).toMatchObject({ state: "open", overnight: true }));
  it("round-trips, including overnight and closed days", () => {
    const hours: WeeklyHours = { mon: ["08:00", "20:00"], fri: ["18:00", "02:00"], sat: ["00:00", "00:00"], sun: null };
    expect(hoursFromRows(rowsFromHours({ ...hours }))).toEqual(hours);
  });
  it("stores nothing when every day is unknown", () => expect(hoursFromRows(rowsFromHours(null))).toBeNull());
  it("leaves unknown days out rather than guessing", () => {
    const rows: DayRow[] = rowsFromHours(null).map((r) => (r.day === "wed" ? { ...r, state: "open", opens: "09:00", closes: "17:00" } : r));
    expect(hoursFromRows(rows)).toEqual({ wed: ["09:00", "17:00"] });
  });
});

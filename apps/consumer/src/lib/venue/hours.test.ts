import { describe, expect, it } from "vitest";
import { formatTime, isOpen247, isOpenAt, venueClock, weeklyRows } from "./hours";

// Manila is UTC+8 with no daylight saving. 2026-09-25 is a Friday.
const at = (manilaIso: string) => new Date(`${manilaIso}+08:00`);

describe("venueClock", () => {
  it("reads the time in Manila regardless of the device's zone", () => {
    expect(venueClock(at("2026-09-25T09:30"))).toEqual({ day: "fri", minutes: 570 });
  });
});

describe("isOpenAt", () => {
  const friday = { fri: ["10:00", "22:00"] as [string, string] };

  it("is closed before opening time", () => expect(isOpenAt(friday, at("2026-09-25T09:59"))).toBe(false));
  it("is open from opening time", () => expect(isOpenAt(friday, at("2026-09-25T10:00"))).toBe(true));
  it("is closed at closing time", () => expect(isOpenAt(friday, at("2026-09-25T22:00"))).toBe(false));
  it("says nothing when today's hours are unknown", () => expect(isOpenAt(friday, at("2026-09-26T12:00"))).toBeNull());
  it("is closed on a day marked closed", () => expect(isOpenAt({ sat: null }, at("2026-09-26T12:00"))).toBe(false));
  it("says nothing when there are no hours", () => expect(isOpenAt(null, at("2026-09-25T12:00"))).toBeNull());

  describe("overnight spans", () => {
    const night = { fri: ["18:00", "02:00"] as [string, string], sat: null };
    it("is open late on the opening day", () => expect(isOpenAt(night, at("2026-09-25T23:30"))).toBe(true));
    it("stays open past midnight into a closed day", () => expect(isOpenAt(night, at("2026-09-26T01:30"))).toBe(true));
    it("closes at the overnight closing time", () => expect(isOpenAt(night, at("2026-09-26T02:00"))).toBe(false));
  });

  it("treats 00:00–00:00 as open all day", () => expect(isOpenAt({ fri: ["00:00", "00:00"] }, at("2026-09-25T03:00"))).toBe(true));
  it("treats 00:00–24:00 as open all day", () => expect(isOpenAt({ fri: ["00:00", "24:00"] }, at("2026-09-25T23:59"))).toBe(true));
});

describe("formatTime", () => {
  it.each([
    ["08:00", "8:00 AM"],
    ["12:30", "12:30 PM"],
    ["00:15", "12:15 AM"],
    ["24:00", "12:00 AM"],
  ])("%s → %s", (input, expected) => expect(formatTime(input)).toBe(expected));
});

describe("weeklyRows", () => {
  const rows = weeklyRows({ fri: ["10:00", "22:00"], sun: null, mon: ["00:00", "00:00"] });
  it("leaves unknown days unknown", () => expect(rows.find((r) => r.day === "tue")!.text).toBeNull());
  it("formats an open day", () => expect(rows.find((r) => r.day === "fri")!.text).toBe("10:00 AM – 10:00 PM"));
  it("marks a closed day", () => expect(rows.find((r) => r.day === "sun")!.text).toBe("Closed"));
  it("marks a 24-hour day", () => expect(rows.find((r) => r.day === "mon")!.text).toBe("Open 24 hours"));
  it("starts the week on Monday", () => expect(rows.map((r) => r.day)).toEqual(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]));
});

describe("isOpen247", () => {
  const allDay = ["00:00", "00:00"] as [string, string];
  it("needs every day open all day", () =>
    expect(isOpen247({ mon: allDay, tue: allDay, wed: allDay, thu: allDay, fri: allDay, sat: allDay, sun: allDay })).toBe(true));
  it("is false when one day is missing", () =>
    expect(isOpen247({ mon: allDay, tue: allDay, wed: allDay, thu: allDay, fri: allDay, sat: allDay })).toBe(false));
});

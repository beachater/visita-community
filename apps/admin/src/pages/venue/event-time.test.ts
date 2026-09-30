import { describe, expect, it } from "vitest";
import { eventWhen, isoToManilaInput, manilaInputToIso } from "./event-time";

describe("Manila time inputs", () => {
  it("reads a datetime-local value as Manila time", () => expect(manilaInputToIso("2026-10-02T18:30")).toBe("2026-10-02T10:30:00.000Z"));
  it("writes a stored time back as Manila local time", () => expect(isoToManilaInput("2026-10-02T10:30:00.000Z")).toBe("2026-10-02T18:30"));
  it("round-trips across midnight", () => expect(isoToManilaInput(manilaInputToIso("2026-10-03T01:15")!)).toBe("2026-10-03T01:15"));
  it("rejects an empty or malformed value", () => {
    expect(manilaInputToIso("")).toBeNull();
    expect(manilaInputToIso("tomorrow")).toBeNull();
  });
});

describe("eventWhen", () => {
  const now = new Date("2026-10-02T04:00:00Z"); // 12:00 in Manila
  it("marks an event happening now", () => expect(eventWhen("2026-10-02T02:00:00Z", "2026-10-02T06:00:00Z", now)).toBe("now"));
  it("marks an upcoming event", () => expect(eventWhen("2026-10-03T10:00:00Z", "2026-10-03T12:00:00Z", now)).toBe("upcoming"));
  it("marks a finished event", () => expect(eventWhen("2026-10-01T10:00:00Z", "2026-10-01T12:00:00Z", now)).toBe("past"));
});

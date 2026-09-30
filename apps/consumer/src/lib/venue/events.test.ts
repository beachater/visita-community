import { describe, expect, it } from "vitest";
import { eventRange, upcomingEventsPath } from "./events";

describe("eventRange", () => {
  it("shows one date for a same-day event", () =>
    expect(eventRange("2026-10-02T10:00:00Z", "2026-10-02T13:00:00Z")).toBe("Fri, Oct 2 · 6:00 PM – 9:00 PM"));
  it("shows both dates for an event over several days", () =>
    expect(eventRange("2026-10-02T02:00:00Z", "2026-10-04T10:00:00Z")).toBe("Fri, Oct 2, 10:00 AM – Sun, Oct 4, 6:00 PM"));
  it("treats an event ending after midnight as the same night", () =>
    expect(eventRange("2026-10-02T12:00:00Z", "2026-10-02T18:00:00Z")).toBe("Fri, Oct 2 · 8:00 PM – 2:00 AM"));
});

describe("upcomingEventsPath", () => {
  it("asks for current and upcoming events, soonest first", () => {
    const path = upcomingEventsPath("v1", new Date("2026-10-02T00:00:00Z"));
    expect(path).toContain("venue_id=eq.v1");
    expect(path).toContain("ends_at=gt.2026-10-02T00%3A00%3A00.000Z");
    expect(path).toContain("order=starts_at.asc");
  });
});

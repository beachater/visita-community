import { describe, expect, it } from "vitest";
import { groupDisputes, type ConfirmRow, type DisputeRow } from "./amenity-reports";

const dispute = (over: Partial<DisputeRow>): DisputeRow => ({
  id: "r1",
  venue_id: "v1",
  venue_name: "Kape",
  amenity_key: "wifi",
  comment: null,
  reporter: "Ana",
  created_at: "2026-10-01T00:00:00Z",
  ...over,
});
const confirm = (over: Partial<ConfirmRow>): ConfirmRow => ({ venue_id: "v1", amenity_key: "wifi", created_at: "2026-10-05T00:00:00Z", ...over });

describe("groupDisputes", () => {
  it("groups open disputes by venue and amenity, newest report first", () => {
    const groups = groupDisputes(
      [
        dispute({ id: "a", created_at: "2026-10-01T00:00:00Z" }),
        dispute({ id: "b", created_at: "2026-10-03T00:00:00Z" }),
        dispute({ id: "c", amenity_key: "power_outlets" }),
      ],
      [],
    );
    expect(groups.map((g) => [g.venueId, g.amenityKey, g.reports.map((r) => r.id)])).toEqual([
      ["v1", "wifi", ["b", "a"]],
      ["v1", "power_outlets", ["c"]],
    ]);
  });

  it("puts the most-reported amenity first, then the longest waiting", () => {
    const groups = groupDisputes(
      [
        dispute({ id: "new", venue_id: "v2", created_at: "2026-10-09T00:00:00Z" }),
        dispute({ id: "old", venue_id: "v3", created_at: "2026-09-01T00:00:00Z" }),
        dispute({ id: "x1", venue_id: "v4", created_at: "2026-10-10T00:00:00Z" }),
        dispute({ id: "x2", venue_id: "v4", created_at: "2026-10-11T00:00:00Z" }),
      ],
      [],
    );
    expect(groups.map((g) => g.venueId)).toEqual(["v4", "v3", "v2"]);
  });

  it("dates a group from its first and latest report", () => {
    const [g] = groupDisputes([dispute({ id: "a", created_at: "2026-10-01T00:00:00Z" }), dispute({ id: "b", created_at: "2026-10-04T00:00:00Z" })], []);
    expect([g!.firstAt, g!.lastAt]).toEqual(["2026-10-01T00:00:00Z", "2026-10-04T00:00:00Z"]);
  });

  it("counts confirmations of the same amenity made after the first dispute", () => {
    const [g] = groupDisputes(
      [dispute({ created_at: "2026-10-03T00:00:00Z" })],
      [
        confirm({ created_at: "2026-10-01T00:00:00Z" }),
        confirm({ created_at: "2026-10-04T00:00:00Z" }),
        confirm({ created_at: "2026-10-06T00:00:00Z" }),
        confirm({ amenity_key: "power_outlets", created_at: "2026-10-06T00:00:00Z" }),
        confirm({ venue_id: "v9", created_at: "2026-10-06T00:00:00Z" }),
      ],
    );
    expect(g!.confirmsSince).toBe(2);
  });

  it("returns nothing when there are no disputes", () => expect(groupDisputes([], [confirm({})])).toEqual([]));
});

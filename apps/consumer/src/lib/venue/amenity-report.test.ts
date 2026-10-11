import { describe, expect, it } from "vitest";
import { amenityReturnPath, confirmationText, parseAmenityReport } from "./amenity-report";

const venueId = "aaaaaaaa-0000-0000-0000-000000000001";

describe("amenity report input", () => {
  it("accepts a confirmation without a comment", () =>
    expect(parseAmenityReport({ venueId, amenityKey: "wifi", verdict: "confirm" })).toEqual({
      ok: true, report: { venueId, amenityKey: "wifi", verdict: "confirm", comment: null },
    }));
  it("trims an optional dispute note", () =>
    expect(parseAmenityReport({ venueId, amenityKey: "wifi", verdict: "dispute", comment: "  New hours  " })).toMatchObject({
      ok: true, report: { comment: "New hours" },
    }));
  it("rejects an overlong note and a commented confirmation", () => {
    expect(parseAmenityReport({ venueId, amenityKey: "wifi", verdict: "dispute", comment: "x".repeat(301) }).ok).toBe(false);
    expect(parseAmenityReport({ venueId, amenityKey: "wifi", verdict: "confirm", comment: "x" }).ok).toBe(false);
  });
});

describe("amenity display", () => {
  it("shows no count when there are no recent confirmations", () => expect(confirmationText(0)).toBeNull());
  it("uses the right count wording", () => {
    expect(confirmationText(1)).toBe("Confirmed by 1 person recently");
    expect(confirmationText(2)).toBe("Confirmed by 2 people recently");
  });
  it("returns to the same walkthrough amenity", () =>
    expect(amenityReturnPath("cafe-one", "wifi", true)).toBe("/cafe/cafe-one?amenity=wifi&walkthrough=1#amenity-wifi"));
});

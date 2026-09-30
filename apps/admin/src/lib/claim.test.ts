import { describe, expect, it } from "vitest";
import { validateClaim } from "./claim";

const base = { venueId: "v1", newVenue: null, roleTitle: "Owner", contactPhone: "0917 123 4567", hasProof: true };

describe("validateClaim", () => {
  it("accepts a claim on an existing listing", () => expect(validateClaim(base)).toEqual({}));
  it("accepts a new-listing request", () =>
    expect(validateClaim({ ...base, venueId: null, newVenue: { name: "Bagong Kape", address: "Divisoria" } })).toEqual({}));
  it("needs a cafe", () => expect(validateClaim({ ...base, venueId: null })).toHaveProperty("venue"));
  it("needs a name for a new listing", () =>
    expect(validateClaim({ ...base, venueId: null, newVenue: { name: "  ", address: "" } })).toHaveProperty("venue"));
  it("needs a role", () => expect(validateClaim({ ...base, roleTitle: " " })).toHaveProperty("roleTitle"));
  it.each(["+63 917 123 4567", "09171234567", "(088) 856-1234"])("accepts the number %s", (n) =>
    expect(validateClaim({ ...base, contactPhone: n })).toEqual({}));
  it.each(["", "call me", "123", "+63 917 123 4567 ext 5 please"])("rejects the number %j", (n) =>
    expect(validateClaim({ ...base, contactPhone: n })).toHaveProperty("contactPhone"));
  it("needs proof", () => expect(validateClaim({ ...base, hasProof: false })).toHaveProperty("proof"));
});

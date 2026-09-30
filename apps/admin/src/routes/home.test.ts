import { describe, expect, it } from "vitest";
import { homeFor, type ClaimSummary } from "./home";

const claim = (over: Partial<ClaimSummary>): ClaimSummary => ({ id: "c1", status: "pending", venueId: "v1", ...over });

describe("homeFor", () => {
  it("sends admins to the approval queue", () => expect(homeFor({ isAdmin: true, claims: [claim({ status: "approved" })] })).toBe("/admin/approvals"));
  it("sends an approved owner to their venue", () => expect(homeFor({ isAdmin: false, claims: [claim({ status: "approved", venueId: "v9" })] })).toBe("/venue/v9"));
  it("lists venues when someone owns several", () =>
    expect(homeFor({ isAdmin: false, claims: [claim({ status: "approved", venueId: "a" }), claim({ id: "c2", status: "approved", venueId: "b" })] })).toBe("/venues"));
  it("shows the status page while a claim is pending", () => expect(homeFor({ isAdmin: false, claims: [claim({ status: "pending" })] })).toBe("/status"));
  it("shows the status page after a rejection, so the note is seen", () => expect(homeFor({ isAdmin: false, claims: [claim({ status: "rejected" })] })).toBe("/status"));
  it("starts the claim flow for someone with no claims", () => expect(homeFor({ isAdmin: false, claims: [] })).toBe("/claim"));
  it("prefers an approved venue over other pending claims", () =>
    expect(homeFor({ isAdmin: false, claims: [claim({ id: "c2", status: "pending" }), claim({ status: "approved", venueId: "v2" })] })).toBe("/venue/v2"));
});

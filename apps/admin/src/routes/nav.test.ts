import { describe, expect, it } from "vitest";
import { navFor, type NavClaim } from "./nav";

const claim = (over: Partial<NavClaim>): NavClaim => ({ id: "c1", status: "approved", venueId: "v1", venueName: "Sonny's", proposedName: null, ...over });
const labels = (groups: ReturnType<typeof navFor>) => groups.map((g) => [g.label, g.items.map((i) => i.label)]);

describe("navFor", () => {
  it("gives someone with no claims only the claim links", () =>
    expect(labels(navFor({ isAdmin: false, claims: [] }, "/claim"))).toEqual([["Claims", ["My claims", "Claim a cafe"]]]));

  it("lists an owner's cafe by name, opened to its pages", () => {
    const [cafes] = navFor({ isAdmin: false, claims: [claim({})] }, "/status");
    expect(cafes!.label).toBe("Your cafe");
    expect(cafes!.items[0]).toMatchObject({ to: "/venue/v1", label: "Sonny's", expanded: true });
    expect(cafes!.items[0]!.children!.map((c) => c.to)).toEqual(["/venue/v1", "/venue/v1/listing", "/venue/v1/events", "/venue/v1/reviews", "/venue/v1/analytics", "/venue/v1/billing"]);
  });

  it("opens only the cafe being viewed when someone owns several", () => {
    const [cafes] = navFor({ isAdmin: false, claims: [claim({}), claim({ id: "c2", venueId: "v2", venueName: "Kape" })] }, "/venue/v2/events");
    expect(cafes!.label).toBe("Your cafes");
    expect(cafes!.items.map((i) => [i.label, i.expanded])).toEqual([["Sonny's", false], ["Kape", true]]);
  });

  it("doesn't open a cafe whose id only starts the same", () => {
    const [cafes] = navFor({ isAdmin: false, claims: [claim({ venueId: "v1" }), claim({ id: "c2", venueId: "v12" })] }, "/venue/v12");
    expect(cafes!.items.map((i) => i.expanded)).toEqual([false, true]);
  });

  it("leaves out pending and rejected claims from the cafe list", () =>
    expect(labels(navFor({ isAdmin: false, claims: [claim({ status: "pending" }), claim({ id: "c2", status: "rejected" })] }, "/status"))).toEqual([["Claims", ["My claims", "Claim a cafe"]]]));

  it("falls back to the proposed name for a new venue", () => {
    const [cafes] = navFor({ isAdmin: false, claims: [claim({ venueName: null, proposedName: "New Cafe" })] }, "/");
    expect(cafes!.items[0]!.label).toBe("New Cafe");
  });

  it("adds the admin tools for admins, last", () =>
    expect(labels(navFor({ isAdmin: true, claims: [] }, "/admin/venues"))).toEqual([
      ["Claims", ["My claims", "Claim a cafe"]],
      ["Admin", ["Owner approvals", "Venues", "Demand queue", "Billing", "Amenity changes", "Amenity reports", "Reviews"]],
    ]));
});

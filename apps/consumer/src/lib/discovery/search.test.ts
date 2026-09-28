import { describe, expect, it } from "vitest";
import { venue } from "./fixtures";
import { normalize, searchVenues } from "./search";

const sonnys = venue({ slug: "sonnys", name: "Sonny's Coffee + Diner", searchTerms: ["sonnys diner"], scanned: true });
const elysee = venue({ slug: "elysee-cafe", name: "Elysée Cafe", address: "Elysée Cafe, Cagayan de Oro", scanned: false });
const ustp = venue({ slug: "ustp-cafeteria", name: "USTP Cafeteria", searchTerms: ["ustp", "cafeteria"], scanned: false });
const litos = venue({ slug: "litos", name: "Lito's Meals and Cafe", scanned: true });
const all = [elysee, ustp, sonnys, litos];

describe("normalize", () => {
  it("ignores case, accents and apostrophes", () => expect(normalize("Elysée  SONNY'S")).toBe("elysee sonnys"));
});

describe("searchVenues", () => {
  it("returns nothing for an empty query", () => expect(searchVenues(all, "   ")).toEqual([]));
  it("finds a name without its apostrophe", () => expect(searchVenues(all, "sonnys").map((v) => v.slug)).toEqual(["sonnys"]));
  it("finds a name without its accent", () => expect(searchVenues(all, "elysee")[0]!.slug).toBe("elysee-cafe"));
  it("matches search terms", () => expect(searchVenues(all, "diner").map((v) => v.slug)).toContain("sonnys"));
  it("ranks a name that starts with the query above one that only contains it", () => {
    const results = searchVenues(all, "caf").map((v) => v.slug);
    expect(results.indexOf("ustp-cafeteria")).toBeGreaterThan(-1);
    expect(results.indexOf("elysee-cafe")).toBeGreaterThan(-1);
  });
  it("puts scanned cafes first among equal matches", () => {
    // "Cafe" appears mid-name for Lito's (scanned) and Elysée (not scanned).
    const results = searchVenues([elysee, litos], "cafe").map((v) => v.slug);
    expect(results).toEqual(["litos", "elysee-cafe"]);
  });
  it("prefers a match at the start of the name", () =>
    expect(searchVenues([litos, ustp], "ustp").map((v) => v.slug)).toEqual(["ustp-cafeteria"]));
  it("matches every word of a multi-word query", () => expect(searchVenues(all, "lito meals").map((v) => v.slug)).toEqual(["litos"]));
});

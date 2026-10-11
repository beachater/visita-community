import { describe, expect, it } from "vitest";
import { demandView, type DemandRow } from "./demand-queue";

const row = (over: Partial<DemandRow>): DemandRow => ({
  venue_id: "v1",
  name: "Kape",
  slug: "kape",
  address: null,
  is_published: true,
  scanned: false,
  has_owner: false,
  total: 1,
  last_7_days: 0,
  last_30_days: 1,
  signed_in: 0,
  first_at: "2026-09-01T00:00:00Z",
  last_at: "2026-10-01T00:00:00Z",
  ...over,
});

describe("demandView", () => {
  const rows = [
    row({ venue_id: "a", name: "Old favourite", total: 9, last_30_days: 1, last_at: "2026-09-20T00:00:00Z" }),
    row({ venue_id: "b", name: "Rising", total: 4, last_30_days: 4, last_at: "2026-10-10T00:00:00Z" }),
    row({ venue_id: "c", name: "Scanned now", total: 20, last_30_days: 10, scanned: true }),
  ];
  const ids = (r: DemandRow[]) => r.map((x) => x.venue_id);

  it("hides venues that have been scanned since, by default", () => expect(ids(demandView(rows, { sort: "recent", showScanned: false }))).toEqual(["b", "a"]));
  it("can include scanned venues", () => expect(ids(demandView(rows, { sort: "recent", showScanned: true }))).toEqual(["c", "b", "a"]));
  it("ranks by all-time requests", () => expect(ids(demandView(rows, { sort: "total", showScanned: false }))).toEqual(["a", "b"]));
  it("ranks by the latest request", () => expect(ids(demandView(rows, { sort: "latest", showScanned: false }))).toEqual(["b", "a"]));
  it("breaks ties by all-time total", () =>
    expect(ids(demandView([row({ venue_id: "x", last_30_days: 2, total: 2 }), row({ venue_id: "y", last_30_days: 2, total: 5 })], { sort: "recent", showScanned: false }))).toEqual(["y", "x"]));
  it("doesn't reorder the rows it was given", () => {
    demandView(rows, { sort: "total", showScanned: true });
    expect(ids(rows)).toEqual(["a", "b", "c"]);
  });
});

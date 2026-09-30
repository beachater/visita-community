import { describe, expect, it } from "vitest";
import { isScanKey, isScanKeyFor, nextVersion, partCount, PART_SIZE, scanKey } from "./scan-keys";

describe("nextVersion", () => {
  it("starts at 1 for a venue with no scans", () => expect(nextVersion([], "sonnys")).toBe(1));
  it("goes one past the highest existing version, whatever else is in the folder", () =>
    expect(
      nextVersion(
        ["splats/sonnys/v1.sog", "splats/sonnys/v1-preview.sog", "splats/sonnys/v1/lod-meta.json", "splats/sonnys/test-750k.sog", "splats/sonnys/v3.sog"],
        "sonnys",
      ),
    ).toBe(4));
  it("ignores other venues' folders", () => expect(nextVersion(["splats/sonnys-2/v9.sog"], "sonnys")).toBe(1));
});

describe("scanKey / isScanKeyFor", () => {
  it("names the full scan and its preview", () => {
    expect(scanKey("litos", 2, "full")).toBe("splats/litos/v2.sog");
    expect(scanKey("litos", 2, "preview")).toBe("splats/litos/v2-preview.sog");
  });
  it("accepts only this venue's versioned scan keys", () => {
    expect(isScanKeyFor("splats/litos/v2.sog", "litos")).toBe(true);
    expect(isScanKeyFor("splats/litos/v2-preview.sog", "litos")).toBe(true);
    expect(isScanKeyFor("splats/sonnys/v2.sog", "litos")).toBe(false);
    expect(isScanKeyFor("splats/litos/../sonnys/v2.sog", "litos")).toBe(false);
    expect(isScanKeyFor("basemaps/cdo.pmtiles", "litos")).toBe(false);
  });
});

describe("partCount", () => {
  it("splits a 43 MB scan into 25 MB parts", () => expect(partCount(43 * 1024 * 1024)).toBe(2));
  it("sends a small file in one part", () => expect(partCount(1000)).toBe(1));
  it("uses parts of at least 5 MB, as R2 requires", () => expect(PART_SIZE).toBeGreaterThanOrEqual(5 * 1024 * 1024));
});

describe("isScanKey", () => {
  it.each(["splats/litos/v2.sog", "splats/bagong-kape/v10-preview.sog"])("accepts %s", (k) => expect(isScanKey(k)).toBe(true));
  it.each(["splats/litos/v2.ply", "splats/Litos/v2.sog", "splats/../x/v1.sog", "reviews/x/v1.sog", "splats/litos/v1/lod-meta.json"])("refuses %s", (k) =>
    expect(isScanKey(k)).toBe(false));
});

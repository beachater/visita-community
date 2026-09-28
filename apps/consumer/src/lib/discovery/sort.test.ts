import { describe, expect, it } from "vitest";
import { venue } from "./fixtures";
import { sortVenues, withDistance } from "./sort";

const near = venue({ slug: "near", name: "Zed Cafe", lat: 8.4822, lng: 124.6465, scanned: false });
const far = venue({ slug: "far", name: "Alpha Cafe", lat: 8.52, lng: 124.7, scanned: true });
const nowhere = venue({ slug: "nowhere", name: "Beta Cafe", lat: null, lng: null, scanned: true });
const here = { lat: 8.4823, lng: 124.6466 };

describe("sortVenues", () => {
  it("sorts nearest first when the location is known", () =>
    expect(sortVenues([far, nowhere, near], here).map((v) => v.slug)).toEqual(["near", "far", "nowhere"]));
  it("without a location, puts scanned cafes first, then by name", () =>
    expect(sortVenues([near, nowhere, far], null).map((v) => v.slug)).toEqual(["far", "nowhere", "near"]));
  it("doesn't reorder the caller's array", () => {
    const list = [far, near];
    sortVenues(list, here);
    expect(list.map((v) => v.slug)).toEqual(["far", "near"]);
  });
});

describe("withDistance", () => {
  it("labels each venue's distance", () => expect(withDistance([near], here)[0]!.distance).toBe("20 m away"));
  it("leaves distance empty without a location or coordinates", () => {
    expect(withDistance([near], null)[0]!.distance).toBeNull();
    expect(withDistance([nowhere], here)[0]!.distance).toBeNull();
  });
});

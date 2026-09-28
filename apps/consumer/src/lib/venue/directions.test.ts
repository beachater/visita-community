import { describe, expect, it } from "vitest";
import { appleMapsUrl, googleMapsUrl } from "./directions";

const sonnys = { name: "Sonny's Coffee + Diner", address: "Sonny's, Cagayan de Oro", city: "Cagayan de Oro", lat: 8.47, lng: 124.64, googlePlaceId: null };

describe("googleMapsUrl", () => {
  it("routes to exact coordinates", () => {
    const url = new URL(googleMapsUrl(sonnys));
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/dir/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("destination")).toBe("8.47,124.64");
  });
  it("adds the place id when known", () =>
    expect(new URL(googleMapsUrl({ ...sonnys, googlePlaceId: "ChIJabc" })).searchParams.get("destination_place_id")).toBe("ChIJabc"));
  it("falls back to name and address without coordinates", () =>
    expect(new URL(googleMapsUrl({ ...sonnys, lat: null, lng: null })).searchParams.get("destination")).toBe(
      "Sonny's Coffee + Diner, Sonny's, Cagayan de Oro, Cagayan de Oro",
    ));
});

describe("appleMapsUrl", () => {
  it("routes to coordinates and names the place", () => {
    const url = new URL(appleMapsUrl(sonnys));
    expect(url.host).toBe("maps.apple.com");
    expect(url.searchParams.get("daddr")).toBe("8.47,124.64");
    expect(url.searchParams.get("q")).toBe("Sonny's Coffee + Diner");
  });
});

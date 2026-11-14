import { describe, expect, it } from "vitest";
import { appleMapsUrl, googleEmbedUrl, googleMapsUrl } from "./directions";

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

describe("googleEmbedUrl", () => {
  it("shows the cafe in place mode without an origin", () => {
    const url = new URL(googleEmbedUrl(sonnys, "k"));
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/embed/v1/place");
    expect(url.searchParams.get("key")).toBe("k");
    expect(url.searchParams.get("q")).toBe("8.47,124.64");
  });
  it("draws the route from an origin in directions mode", () => {
    const url = new URL(googleEmbedUrl(sonnys, "k", { lat: 8.5, lng: 124.6 }));
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/embed/v1/directions");
    expect(url.searchParams.get("origin")).toBe("8.5,124.6");
    expect(url.searchParams.get("destination")).toBe("8.47,124.64");
  });
  it("prefers the place id, with the place_id: prefix", () =>
    expect(new URL(googleEmbedUrl({ ...sonnys, googlePlaceId: "ChIJabc" }, "k")).searchParams.get("q")).toBe("place_id:ChIJabc"));
  it("falls back to name and address without coordinates", () =>
    expect(new URL(googleEmbedUrl({ ...sonnys, lat: null, lng: null }, "k", { lat: 1, lng: 2 })).searchParams.get("destination")).toBe(
      "Sonny's Coffee + Diner, Sonny's, Cagayan de Oro, Cagayan de Oro",
    ));
});

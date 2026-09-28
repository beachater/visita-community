import { describe, expect, it } from "vitest";
import { CDO_BOUNDS, CDO_CENTER, mapStyle } from "./map-style";

const url = "https://assets.example/basemaps/cdo-20260927.pmtiles";

describe("mapStyle", () => {
  const style = mapStyle(url);

  it("reads tiles from our PMTiles file", () => {
    const source = style.sources.protomaps as { type: string; url: string };
    expect(source.type).toBe("vector");
    expect(source.url).toBe(`pmtiles://${url}`);
  });
  it("never uses CARTO tiles (commercial licence required)", () => expect(JSON.stringify(style)).not.toMatch(/cartocdn/i));
  it("has basemap layers", () => expect(style.layers.length).toBeGreaterThan(20));
  it("labels in English", () => expect(JSON.stringify(style.layers)).toMatch(/name:en/));
  it("has fonts and icons for labels", () => {
    expect(style.glyphs).toMatch(/\{fontstack\}.*\{range\}/);
    expect(style.sprite).toBeTruthy();
  });
});

describe("CDO view", () => {
  it("centres on Cagayan de Oro", () => {
    expect(CDO_CENTER[1]).toBeCloseTo(8.48, 1);
    expect(CDO_CENTER[0]).toBeCloseTo(124.65, 1);
  });
  it("keeps the view inside the basemap extract", () => {
    const [[w, s], [e, n]] = CDO_BOUNDS;
    expect([w, s, e, n]).toEqual([124.38, 8.22, 124.88, 8.65]);
  });
});

import type { StyleSpecification } from "maplibre-gl";
import { layers, namedFlavor } from "@protomaps/basemaps";

// The discovery map's basemap: a Protomaps vector extract of Cagayan de Oro
// served from our R2 bucket (see infra/r2/README.md). No API key, no per-use
// cost, and no commercial-licence issue. Fonts and icons come from the
// Protomaps assets site. Colours are provisional, like the rest of the
// branding: the "light" flavour until the final design says otherwise.

/** Downtown Cagayan de Oro, [lng, lat]. */
export const CDO_CENTER: [number, number] = [124.6465, 8.4822];

/** The basemap extract's bounds; panning stops here so the map never runs out. */
export const CDO_BOUNDS: [[number, number], [number, number]] = [
  [124.38, 8.22],
  [124.88, 8.65],
];

const ASSETS = "https://protomaps.github.io/basemaps-assets";

export function mapStyle(basemapUrl: string): StyleSpecification {
  return {
    version: 8,
    glyphs: `${ASSETS}/fonts/{fontstack}/{range}.pbf`,
    sprite: `${ASSETS}/sprites/v4/light`,
    sources: {
      protomaps: {
        type: "vector",
        url: `pmtiles://${basemapUrl}`,
        attribution: '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    layers: layers("protomaps", namedFlavor("light"), { lang: "en" }),
  };
}

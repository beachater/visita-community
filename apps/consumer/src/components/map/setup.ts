import * as maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

// One-time MapLibre setup, imported before any map renders:
//  - the worker is bundled and served from our own origin, never a public CDN;
//  - "pmtiles://" URLs read the basemap straight from R2 with range requests.
let done = false;

export function setupMapLibre(): void {
  if (done || typeof window === "undefined") return;
  done = true;
  maplibregl.setWorkerUrl(workerUrl);
  maplibregl.addProtocol("pmtiles", new Protocol().tile);
}

/** R2 key of the current basemap extract (see infra/r2/README.md). */
export const BASEMAP_KEY = import.meta.env.PUBLIC_BASEMAP_KEY ?? "basemaps/cdo-20260927.pmtiles";

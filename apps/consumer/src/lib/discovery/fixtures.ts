import type { MapVenue } from "./venues";

// Test fixtures shaped like the real imported cafes. Test-only.
export const venue = (over: Partial<MapVenue> = {}): MapVenue => ({
  id: "aaaaaaaa-0000-0000-0000-000000000001",
  slug: "sonnys",
  name: "Sonny's Coffee + Diner",
  address: null,
  city: "Cagayan de Oro",
  lat: 8.47,
  lng: 124.64,
  googlePlaceId: null,
  scanned: true,
  splatKey: "splats/sonnys/v1.sog",
  previewKey: null,
  scannedAt: null,
  amenities: {},
  hours: null,
  menu: [],
  isTopPick: false,
  searchTerms: [],
  ...over,
});

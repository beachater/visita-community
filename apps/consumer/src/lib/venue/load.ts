import type { AmenityDefinition, MenuItem, Tables, VenueAmenities, WeeklyHours } from "@visita/shared-types";
import { readPublic } from "../public-data";
import type { WalkthroughCafe } from "./types";

// Build-time loading of published cafes, shared by every page that renders
// one (the cafe page, the lab walkthrough screen, later the map's data file).

export type CafeRow = Pick<
  Tables<"venues">,
  | "slug"
  | "name"
  | "address"
  | "city"
  | "lat"
  | "lng"
  | "google_place_id"
  | "splat_url"
  | "splat_preview_url"
  | "scanned_at"
  | "amenities"
  | "hours"
  | "menu"
>;

const CAFE_COLUMNS = "slug,name,address,city,lat,lng,google_place_id,splat_url,splat_preview_url,scanned_at,amenities,hours,menu";

export async function loadPublishedCafes(): Promise<{ cafes: CafeRow[]; definitions: AmenityDefinition[] }> {
  const [cafes, definitions] = await Promise.all([
    readPublic<CafeRow>(`venues?select=${CAFE_COLUMNS}&venue_type=eq.cafe&is_published=eq.true&order=name`),
    readPublic<AmenityDefinition>("amenity_definitions?venue_type=eq.cafe&is_active=eq.true&order=sort_order"),
  ]);
  return { cafes, definitions };
}

/** The walkthrough's view of a cafe, or null when it isn't scanned. */
export function toWalkthroughCafe(cafe: CafeRow): WalkthroughCafe | null {
  if (!cafe.splat_url) return null;
  return {
    slug: cafe.slug,
    name: cafe.name,
    address: cafe.address,
    city: cafe.city,
    lat: cafe.lat,
    lng: cafe.lng,
    googlePlaceId: cafe.google_place_id,
    splatKey: cafe.splat_url,
    previewKey: cafe.splat_preview_url,
    scannedAt: cafe.scanned_at,
    amenities: cafe.amenities as VenueAmenities,
    hours: cafe.hours as WeeklyHours | null,
    menu: cafe.menu as unknown as MenuItem[],
  };
}

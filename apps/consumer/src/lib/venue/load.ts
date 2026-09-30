import type { AmenityDefinition, Tables } from "@visita/shared-types";
import { readPublic } from "../public-data";
import { toMapVenue, toWalkthrough } from "../discovery/venues";
import type { WalkthroughCafe } from "./types";

// Build-time loading of published cafes, shared by every page that renders
// one (the cafe page, the lab walkthrough screen, later the map's data file).

export type CafeRow = Pick<
  Tables<"venues">,
  | "id"
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
  | "is_top_pick"
  | "search_terms"
>;

const CAFE_COLUMNS =
  "id,slug,name,address,city,lat,lng,google_place_id,splat_url,splat_preview_url,scanned_at,amenities,hours,menu,is_top_pick,search_terms";

export async function loadPublishedCafes(): Promise<{ cafes: CafeRow[]; definitions: AmenityDefinition[] }> {
  const [cafes, definitions] = await Promise.all([
    readPublic<CafeRow>(`venues?select=${CAFE_COLUMNS}&venue_type=eq.cafe&is_published=eq.true&order=name`),
    readPublic<AmenityDefinition>("amenity_definitions?venue_type=eq.cafe&is_active=eq.true&order=sort_order"),
  ]);
  return { cafes, definitions };
}

/** The walkthrough's view of a cafe, or null when it isn't scanned. */
export const toWalkthroughCafe = (cafe: CafeRow): WalkthroughCafe | null => toWalkthrough(toMapVenue(cafe));

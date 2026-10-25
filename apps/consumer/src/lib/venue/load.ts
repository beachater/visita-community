import type { AmenityDefinition, Tables } from "@visita/shared-types";
import { readPublic } from "../public-data";
import { toMapVenue, toWalkthrough } from "../discovery/venues";
import type { WalkthroughCafe } from "./types";

// Loading published cafes, at build time (lab pages) or per request (the cafe
// page and the map's venue list, cached at the edge; plan Task 1b).

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
  | "scan_experience"
  | "amenities"
  | "hours"
  | "menu"
  | "is_top_pick"
  | "search_terms"
>;

const CAFE_COLUMNS =
  "id,slug,name,address,city,lat,lng,google_place_id,splat_url,splat_preview_url,scanned_at,scan_experience,amenities,hours,menu,is_top_pick,search_terms";

export async function loadPublishedCafes(): Promise<{ cafes: CafeRow[]; definitions: AmenityDefinition[] }> {
  const [cafes, definitions] = await Promise.all([
    readPublic<CafeRow>(`venues?select=${CAFE_COLUMNS}&venue_type=eq.cafe&is_published=eq.true&order=name`),
    readPublic<AmenityDefinition>(DEFINITIONS),
  ]);
  return { cafes, definitions };
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DEFINITIONS = "amenity_definitions?venue_type=eq.cafe&is_active=eq.true&order=sort_order";

/** PostgREST path for one published cafe, or null for a slug that can't exist. */
export function cafePath(slug: string): string | null {
  if (slug.length > 120 || !SLUG.test(slug)) return null;
  return `venues?select=${CAFE_COLUMNS}&slug=eq.${slug}&venue_type=eq.cafe&is_published=eq.true&limit=1`;
}

/** One published cafe and the amenity catalog, or null when there's no such cafe. */
export async function loadPublishedCafe(slug: string): Promise<{ cafe: CafeRow; definitions: AmenityDefinition[] } | null> {
  const path = cafePath(slug);
  if (!path) return null;
  const [rows, definitions] = await Promise.all([readPublic<CafeRow>(path), readPublic<AmenityDefinition>(DEFINITIONS)]);
  return rows[0] ? { cafe: rows[0], definitions } : null;
}

/** The walkthrough's view of a cafe, or null when it isn't scanned. */
export const toWalkthroughCafe = (cafe: CafeRow): WalkthroughCafe | null => toWalkthrough(toMapVenue(cafe));

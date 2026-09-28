import type { MenuItem, VenueAmenities, WeeklyHours } from "@visita/shared-types";
import type { CafeRow } from "../venue/load";
import type { WalkthroughCafe } from "../venue/types";

// What the discovery map knows about each venue: enough for pins, pin cards,
// search and filters, and to open the walkthrough without another request.

export interface MapVenue {
  slug: string;
  name: string;
  address: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
  googlePlaceId: string | null;
  scanned: boolean;
  splatKey: string | null;
  previewKey: string | null;
  scannedAt: string | null;
  amenities: VenueAmenities;
  hours: WeeklyHours | null;
  menu: MenuItem[];
  isTopPick: boolean;
  searchTerms: string[];
}

export type CardAction = "walkthrough" | "demand" | "directions";

export function toMapVenue(row: CafeRow): MapVenue {
  return {
    slug: row.slug,
    name: row.name,
    address: row.address,
    city: row.city,
    lat: row.lat,
    lng: row.lng,
    googlePlaceId: row.google_place_id,
    scanned: row.splat_url !== null,
    splatKey: row.splat_url,
    previewKey: row.splat_preview_url,
    scannedAt: row.scanned_at,
    amenities: (row.amenities ?? {}) as VenueAmenities,
    hours: (row.hours ?? null) as WeeklyHours | null,
    menu: (row.menu ?? []) as unknown as MenuItem[],
    isTopPick: row.is_top_pick,
    searchTerms: row.search_terms ?? [],
  };
}

/** A pin needs coordinates; venues without them still appear in lists and search. */
export const pinnable = (v: MapVenue): v is MapVenue & { lat: number; lng: number } => v.lat !== null && v.lng !== null;

/** PRD 4.1: scanned cafes open the walkthrough; unscanned ones record demand. */
export function cardActions(v: MapVenue): CardAction[] {
  const actions: CardAction[] = [v.scanned ? "walkthrough" : "demand"];
  if (pinnable(v) || v.address) actions.push("directions");
  return actions;
}

export function toWalkthrough(v: MapVenue): WalkthroughCafe | null {
  if (!v.scanned || !v.splatKey) return null;
  return {
    slug: v.slug,
    name: v.name,
    address: v.address,
    city: v.city,
    lat: v.lat,
    lng: v.lng,
    googlePlaceId: v.googlePlaceId,
    splatKey: v.splatKey,
    previewKey: v.previewKey,
    scannedAt: v.scannedAt,
    amenities: v.amenities,
    hours: v.hours,
    menu: v.menu,
  };
}

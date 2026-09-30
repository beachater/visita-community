// The admin venue form (PRD 4.5), checked before saving with the same rules
// the database enforces (slug format, coordinates together and in range).

export interface VenueFormState {
  name: string;
  slug: string;
  address: string;
  city: string;
  lat: string;
  lng: string;
  googlePlaceId: string;
  /** Comma-separated. */
  searchTerms: string;
  isTopPick: boolean;
  isPublished: boolean;
}

export interface VenueRow {
  name: string;
  slug: string;
  address: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
  google_place_id: string | null;
  search_terms: string[];
  is_top_pick: boolean;
  is_published: boolean;
}

export type VenueResult = { ok: true; row: VenueRow } | { ok: false; field: keyof VenueFormState; error: string };

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Same rule as the database's unique_venue_slug(), minus the uniqueness suffix. */
export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

const num = (s: string) => (s.trim() === "" ? null : Number(s.trim()));

export function toVenueRow(f: VenueFormState): VenueResult {
  if (!f.name.trim()) return { ok: false, field: "name", error: "Give the venue a name." };
  if (!SLUG.test(f.slug)) return { ok: false, field: "slug", error: "Use lowercase letters, numbers and single dashes, like sonnys-coffee." };
  if (!f.city.trim()) return { ok: false, field: "city", error: "Which city is it in?" };
  const lat = num(f.lat);
  const lng = num(f.lng);
  if ((lat === null) !== (lng === null)) return { ok: false, field: "lat", error: "Enter both latitude and longitude, or neither." };
  if (lat !== null && lng !== null) {
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return { ok: false, field: "lat", error: "Latitude must be between -90 and 90." };
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return { ok: false, field: "lng", error: "Longitude must be between -180 and 180." };
  }
  return {
    ok: true,
    row: {
      name: f.name.trim(),
      slug: f.slug,
      address: f.address.trim() || null,
      city: f.city.trim(),
      lat,
      lng,
      google_place_id: f.googlePlaceId.trim() || null,
      search_terms: [...new Set(f.searchTerms.split(",").map((t) => t.trim()).filter(Boolean))],
      is_top_pick: f.isTopPick,
      is_published: f.isPublished,
    },
  };
}

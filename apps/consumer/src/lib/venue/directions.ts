// "Get directions" hands off to a maps app (decided 2026-09-28): Visita's job
// is done once the visitor has decided, and Google/Apple Maps route better.

interface Destination {
  name: string;
  address: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
  googlePlaceId: string | null;
}

const query = (d: Destination) => [d.name, d.address, d.city].filter(Boolean).join(", ");

/**
 * Google Maps universal link: opens the app where installed, the website
 * otherwise, on every platform. Coordinates are exact; the place id (when
 * known) makes Google show the venue's own listing.
 */
export function googleMapsUrl(d: Destination): string {
  const params = new URLSearchParams({ api: "1" });
  params.set("destination", d.lat !== null && d.lng !== null ? `${d.lat},${d.lng}` : query(d));
  if (d.googlePlaceId) params.set("destination_place_id", d.googlePlaceId);
  return `https://www.google.com/maps/dir/?${params}`;
}

/** Apple Maps: opens the Maps app on iPhone, iPad and Mac. */
export function appleMapsUrl(d: Destination): string {
  const params = new URLSearchParams({ q: d.name });
  params.set("daddr", d.lat !== null && d.lng !== null ? `${d.lat},${d.lng}` : query(d));
  return `https://maps.apple.com/?${params}`;
}

/** Apple devices get a choice, since many only have Apple Maps installed. */
export function prefersAppleMapsChoice(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod|Macintosh/.test(ua) && !/Android/.test(ua);
}

// Maps Embed API (board decision 2026-11-14, BEA-23): the route inside Visita
// when the admin "In-app Google Maps directions" setting is on. Embed use is
// free; the key is public by design and locked down by API + website
// restrictions in Google Cloud. No key means no in-app directions.

/** The Maps Embed API key, or null when the build doesn't have one. */
export function googleEmbedKey(): string | null {
  return import.meta.env.PUBLIC_GOOGLE_MAPS_EMBED_KEY?.trim() || null;
}

/** Embed place/destination value: the venue's listing when known, else coordinates, else its address. */
const embedPlace = (d: Destination) =>
  d.googlePlaceId ? `place_id:${d.googlePlaceId}` : d.lat !== null && d.lng !== null ? `${d.lat},${d.lng}` : query(d);

/**
 * Maps Embed URL. With an origin, directions mode draws the route; without
 * one (directions mode requires an origin), place mode shows the cafe.
 */
export function googleEmbedUrl(d: Destination, key: string, origin?: { lat: number; lng: number }): string {
  const params = new URLSearchParams({ key });
  if (!origin) {
    params.set("q", embedPlace(d));
    return `https://www.google.com/maps/embed/v1/place?${params}`;
  }
  params.set("origin", `${origin.lat},${origin.lng}`);
  params.set("destination", embedPlace(d));
  return `https://www.google.com/maps/embed/v1/directions?${params}`;
}

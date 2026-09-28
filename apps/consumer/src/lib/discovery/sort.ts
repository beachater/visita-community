import { formatDistance, haversineMeters, type Coords } from "../venue/distance";
import type { MapVenue } from "./venues";

// PRD 4.1: lists sort nearest first when the visitor's location is known.
// Otherwise scanned cafes lead (what Visita is for), then by name.

const meters = (v: MapVenue, here: Coords) =>
  v.lat !== null && v.lng !== null ? haversineMeters(here, { lat: v.lat, lng: v.lng }) : Number.POSITIVE_INFINITY;

export function sortVenues(venues: MapVenue[], here: Coords | null): MapVenue[] {
  const list = [...venues];
  if (here) return list.sort((a, b) => meters(a, here) - meters(b, here) || a.name.localeCompare(b.name));
  return list.sort((a, b) => Number(b.scanned) - Number(a.scanned) || a.name.localeCompare(b.name));
}

export function withDistance(venues: MapVenue[], here: Coords | null): (MapVenue & { distance: string | null })[] {
  return venues.map((v) => {
    const m = here ? meters(v, here) : Number.POSITIVE_INFINITY;
    return { ...v, distance: Number.isFinite(m) ? formatDistance(m) : null };
  });
}

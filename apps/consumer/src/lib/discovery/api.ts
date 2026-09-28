import type { AmenityDefinition } from "@visita/shared-types";
import type { MapVenue } from "./venues";

/** Shape of GET /api/venues.json. */
export interface VenuesPayload {
  generatedAt: string;
  venues: MapVenue[];
  definitions: AmenityDefinition[];
}

export async function fetchVenues(signal?: AbortSignal): Promise<VenuesPayload> {
  const res = await fetch("/api/venues.json", { signal });
  if (!res.ok) throw new Error(`Couldn't load cafes (${res.status}).`);
  return (await res.json()) as VenuesPayload;
}

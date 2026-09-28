import type { APIRoute } from "astro";
import { toMapVenue } from "../../lib/discovery/venues";
import { loadPublishedCafes } from "../../lib/venue/load";

// Every published venue (scanned and not) for the discovery map, plus the
// amenity catalog its cards and filters need. Built at deploy time for now;
// becomes a cached on-request route once the hosted database exists (Task 1b).
export const prerender = true;

export const GET: APIRoute = async () => {
  const { cafes, definitions } = await loadPublishedCafes();
  const body = {
    generatedAt: new Date().toISOString(),
    venues: cafes.map(toMapVenue),
    definitions,
  };
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};

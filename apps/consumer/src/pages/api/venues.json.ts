import type { APIRoute } from "astro";
import { toMapVenue } from "../../lib/discovery/venues";
import { loadPublishedCafes } from "../../lib/venue/load";

// Every published venue (scanned and not) for the discovery map, plus the
// amenity catalog its cards and filters need. Rendered on request and cached
// at the edge for 5 minutes (plan Task 1b; see middleware).
export const prerender = false;

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

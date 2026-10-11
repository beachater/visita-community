import type { APIRoute } from "astro";
import { parseAmenityReport } from "../../lib/venue/amenity-report";
import { isJsonRequest } from "../../lib/server/saved";
import { json, requireSession } from "../../lib/server/session";

export const prerender = false;

export const GET: APIRoute = async ({ locals, url }) => {
  const venueId = url.searchParams.get("venueId");
  if (!venueId || !/^[0-9a-f-]{36}$/i.test(venueId)) return json(400, { error: "Unknown cafe." });
  if (!locals.supabase) return json(503, { error: "Amenity checks aren't available right now." });
  const { data, error } = await locals.supabase.rpc("amenity_confirmations", { p_venue_id: venueId });
  if (error) return json(502, { error: "Couldn't load recent confirmations." });
  let openKeys: string[] = [];
  if (locals.user) {
    const own = await locals.supabase.from("amenity_reports")
      .select("amenity_key").eq("venue_id", venueId).eq("status", "open");
    if (own.error) return json(502, { error: "Couldn't load your amenity checks." });
    openKeys = (own.data ?? []).map((row) => row.amenity_key);
  }
  return json(200, { confirmations: data ?? [], openKeys });
};

export const POST: APIRoute = async (context) => {
  const session = requireSession(context, "Sign in to check an amenity.");
  if (!session.ok) return session.response;
  if (!isJsonRequest(context.request)) return json(415, { error: "Expected JSON." });
  const parsed = parseAmenityReport(await context.request.json().catch(() => null));
  if (!parsed.ok) return json(400, { error: parsed.error });
  const { venueId, amenityKey, verdict, comment } = parsed.report;
  const { error } = await session.supabase.from("amenity_reports")
    .insert({ venue_id: venueId, amenity_key: amenityKey, verdict, comment });
  if (error?.code === "23505") return json(409, { error: "You've already shared an update for this amenity." });
  if (error?.code === "22023" || error?.code === "23514") return json(400, { error: "This amenity has changed. Please refresh the page." });
  if (error) return json(502, { error: "Couldn't send your update. Try again." });
  return json(201, { saved: true });
};

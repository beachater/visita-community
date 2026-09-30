import type { APIRoute } from "astro";
import { json, requireSession } from "../../lib/server/session";
import { isJsonRequest, parseSavedBody } from "../../lib/server/saved";

// /api/saved: the signed-in visitor's saved cafes (PRD 4.1 dock, 4.2).
// Runs as the visitor, so RLS keeps each list private. Signed-out visitors
// get 401 and keep saves on the device.
//   GET            → { slugs } most recently saved first
//   POST {slug}    → save one; POST {slugs} → merge a device list (first = newest)
//   DELETE {slug}  → remove one
export const prerender = false;

const SIGN_IN = "Sign in to save cafes to your account.";

async function venueIds(supabase: NonNullable<App.Locals["supabase"]>, slugs: string[]) {
  const { data, error } = await supabase.from("venues").select("id, slug").in("slug", slugs);
  if (error) throw error;
  const bySlug = new Map((data ?? []).map((v) => [v.slug, v.id]));
  return slugs.flatMap((s) => (bySlug.has(s) ? [bySlug.get(s)!] : []));
}

export const GET: APIRoute = async (context) => {
  const s = requireSession(context, SIGN_IN);
  if (!s.ok) return s.response;
  const { data, error } = await s.supabase
    .from("saved_venues")
    .select("created_at, venues(slug)")
    .order("created_at", { ascending: false });
  if (error) return json(502, { error: "Couldn't load your saved cafes." });
  const slugs = (data ?? []).flatMap((row) => (row.venues?.slug ? [row.venues.slug] : []));
  return json(200, { slugs });
};

export const POST: APIRoute = async (context) => {
  const s = requireSession(context, SIGN_IN);
  if (!s.ok) return s.response;
  if (!isJsonRequest(context.request)) return json(415, { error: "Expected JSON." });
  const parsed = parseSavedBody(await context.request.json().catch(() => null));
  if (!parsed.ok) return json(400, { error: parsed.error });

  const ids = await venueIds(s.supabase, parsed.slugs);
  if (ids.length === 0) return json(404, { error: "Unknown cafe." });
  // Stagger timestamps so the list keeps the order it was sent in.
  const now = Date.now();
  const rows = ids.map((venue_id, i) => ({ profile_id: s.user.id, venue_id, created_at: new Date(now - i).toISOString() }));
  const { error } = await s.supabase.from("saved_venues").upsert(rows, { onConflict: "profile_id,venue_id", ignoreDuplicates: true });
  if (error) return json(502, { error: "Couldn't save that cafe." });
  return json(200, { saved: ids.length });
};

export const DELETE: APIRoute = async (context) => {
  const s = requireSession(context, SIGN_IN);
  if (!s.ok) return s.response;
  if (!isJsonRequest(context.request)) return json(415, { error: "Expected JSON." });
  const body = (await context.request.json().catch(() => null)) as { slug?: unknown } | null;
  const parsed = parseSavedBody(body && "slug" in body ? { slug: body.slug } : null);
  if (!parsed.ok) return json(400, { error: parsed.error });

  const [id] = await venueIds(s.supabase, parsed.slugs);
  if (!id) return json(404, { error: "Unknown cafe." });
  const { error } = await s.supabase.from("saved_venues").delete().eq("venue_id", id);
  if (error) return json(502, { error: "Couldn't remove that cafe." });
  return json(200, { removed: true });
};

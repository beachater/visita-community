import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { parseReviewInput } from "../../lib/reviews/input";
import { isJsonRequest } from "../../lib/server/saved";
import { json, publishedVenueId, requireSession } from "../../lib/server/session";

// /api/reviews: write, edit and delete your own review (PRD 4.3). One review
// per visitor per cafe, so the cafe's slug identifies it. Runs as the
// visitor: RLS and column grants decide what's allowed.
//   POST   {slug, rating, body}               → { id } (409 if you've already reviewed it)
//   PATCH  {slug, rating, body, removePhoto?} → { id }
//   DELETE {slug}                             → { removed }
// Photos are added afterwards with POST /api/uploads/review-photo?review=<id>.
export const prerender = false;

const SIGN_IN = "Sign in to write a review.";

async function readBody(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}

export const POST: APIRoute = async (context) => {
  const s = requireSession(context, SIGN_IN);
  if (!s.ok) return s.response;
  if (!isJsonRequest(context.request)) return json(415, { error: "Expected JSON." });
  const parsed = parseReviewInput(await readBody(context.request));
  if (!parsed.ok) return json(400, { error: parsed.error });

  const venueId = await publishedVenueId(s.supabase, parsed.value.slug);
  if (!venueId) return json(404, { error: "Unknown cafe." });
  const { data, error } = await s.supabase
    .from("reviews")
    .insert({ venue_id: venueId, rating: parsed.value.rating, body: parsed.value.body })
    .select("id")
    .single();
  if (error?.code === "23505") return json(409, { error: "You've already reviewed this cafe. Edit your review instead." });
  // RLS refuses owners reviewing the venue they manage (the only other insert rule, a published venue, was checked above).
  if (error?.code === "42501") return json(403, { error: "You can't review a cafe you manage." });
  if (error || !data) return json(502, { error: "Couldn't post your review. Try again." });
  return json(201, { id: data.id });
};

export const PATCH: APIRoute = async (context) => {
  const s = requireSession(context, SIGN_IN);
  if (!s.ok) return s.response;
  if (!isJsonRequest(context.request)) return json(415, { error: "Expected JSON." });
  const raw = await readBody(context.request);
  const parsed = parseReviewInput(raw);
  if (!parsed.ok) return json(400, { error: parsed.error });
  const removePhoto = Boolean(raw && typeof raw === "object" && (raw as { removePhoto?: unknown }).removePhoto === true);

  const venueId = await publishedVenueId(s.supabase, parsed.value.slug);
  if (!venueId) return json(404, { error: "Unknown cafe." });
  const { data: current } = await s.supabase
    .from("reviews")
    .select("id, photo_url")
    .eq("venue_id", venueId)
    .eq("author_id", s.user.id)
    .maybeSingle();
  if (!current) return json(404, { error: "You haven't reviewed this cafe yet." });

  const { error } = await s.supabase
    .from("reviews")
    .update({ rating: parsed.value.rating, body: parsed.value.body, ...(removePhoto ? { photo_url: null } : {}) })
    .eq("id", current.id);
  if (error) return json(502, { error: "Couldn't save your changes. Try again." });
  if (removePhoto && current.photo_url) await env.ASSETS_BUCKET.delete(current.photo_url);
  return json(200, { id: current.id });
};

export const DELETE: APIRoute = async (context) => {
  const s = requireSession(context, SIGN_IN);
  if (!s.ok) return s.response;
  if (!isJsonRequest(context.request)) return json(415, { error: "Expected JSON." });
  const raw = (await readBody(context.request)) as { slug?: unknown } | null;
  const slug = typeof raw?.slug === "string" ? raw.slug : "";
  const venueId = slug ? await publishedVenueId(s.supabase, slug) : null;
  if (!venueId) return json(404, { error: "Unknown cafe." });

  const { data, error } = await s.supabase
    .from("reviews")
    .delete()
    .eq("venue_id", venueId)
    .eq("author_id", s.user.id)
    .select("photo_url");
  if (error) return json(502, { error: "Couldn't delete your review. Try again." });
  if (!data?.length) return json(404, { error: "You haven't reviewed this cafe." });
  const photos = data.flatMap((r) => (r.photo_url ? [r.photo_url] : []));
  if (photos.length) await env.ASSETS_BUCKET.delete(photos);
  return json(200, { removed: true });
};

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { isReviewPhotoOf } from "@visita/uploads/photo";
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

// The walkthrough reads reviews without leaving the cafe. RLS also returns a
// signed-in visitor's own hidden review, which the client labels separately.
export const GET: APIRoute = async ({ locals, url }) => {
  if (!locals.supabase) return json(503, { error: "Reviews aren't available right now." });
  const slug = url.searchParams.get("slug") ?? "";
  if (!slug) return json(400, { error: "Choose a cafe." });
  try {
    const venueId = await publishedVenueId(locals.supabase, slug);
    if (!venueId) return json(404, { error: "Unknown cafe." });
    const { data, error } = await locals.supabase.from("reviews")
      .select("id, author_id, rating, body, photo_url, status, created_at, profiles(display_name, avatar_url), review_replies(body, created_at)")
      .eq("venue_id", venueId).order("created_at", { ascending: false }).limit(100);
    if (error) return json(502, { error: "Couldn't load reviews. Try again." });
    const rows = data ?? [];
    const own = locals.user ? rows.find((row) => row.author_id === locals.user?.id) : null;
    return json(200, {
      signedIn: Boolean(locals.user),
      own: own ? { rating: own.rating, body: own.body, photoUrl: own.photo_url } : null,
      reviews: rows.filter((row) => row.status === "visible" || row.author_id === locals.user?.id)
        .map((row) => ({
          id: row.id, name: row.profiles?.display_name ?? (row.author_id === locals.user?.id ? "You" : "Visita member"),
          rating: row.rating, body: row.body, photoUrl: row.photo_url,
          createdAt: row.created_at, own: row.author_id === locals.user?.id,
          hidden: row.status === "hidden", reply: row.review_replies,
        })),
    });
  } catch {
    return json(502, { error: "Couldn't load reviews. Try again." });
  }
};

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
  if (removePhoto && current.photo_url && isReviewPhotoOf(current.photo_url, current.id)) await env.ASSETS_BUCKET.delete(current.photo_url);
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
    .select("id, photo_url");
  if (error) return json(502, { error: "Couldn't delete your review. Try again." });
  if (!data?.length) return json(404, { error: "You haven't reviewed this cafe." });
  const photos = data.flatMap((r) => (r.photo_url && isReviewPhotoOf(r.photo_url, r.id) ? [r.photo_url] : []));
  if (photos.length) await env.ASSETS_BUCKET.delete(photos);
  return json(200, { removed: true });
};

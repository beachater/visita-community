import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { checkPhoto, isReviewPhotoOf, MAX_PHOTO_BYTES, reviewPhotoKey } from "@visita/uploads/photo";
import { json, requireSession } from "../../../lib/server/session";

// POST /api/uploads/review-photo?review=<id>: the photo for your own review
// (PRD 4.3, 5.5). The body is the image itself, already resized in the
// browser. It streams into R2 through the Worker's binding, so the server
// checks who's uploading and what the bytes are before anything is stored.
// An image/* Content-Type is required: cross-site pages can't send one
// without a CORS preflight, which this route never approves.
export const prerender = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST: APIRoute = async (context) => {
  const s = requireSession(context, "Sign in to add a photo.");
  if (!s.ok) return s.response;
  const { request, url } = context;

  const reviewId = url.searchParams.get("review") ?? "";
  if (!UUID.test(reviewId)) return json(400, { error: "Missing review." });
  if (!(request.headers.get("content-type") ?? "").startsWith("image/")) return json(415, { error: "Send the photo as an image." });
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_PHOTO_BYTES) return json(413, { error: "Photos can be up to 8 MB." });

  const bytes = new Uint8Array(await request.arrayBuffer());
  const check = checkPhoto(bytes.subarray(0, 16), bytes.byteLength);
  if (!check.ok) return json(check.status, { error: check.error });

  // RLS: visitors can only read other people's reviews when visible, and the
  // author filter means only your own review matches.
  const { data: review } = await s.supabase
    .from("reviews")
    .select("id, photo_url")
    .eq("id", reviewId)
    .eq("author_id", s.user.id)
    .maybeSingle();
  if (!review) return json(404, { error: "That review isn't yours." });

  const key = reviewPhotoKey(review.id, crypto.randomUUID(), check.type);
  await env.ASSETS_BUCKET.put(key, bytes, {
    httpMetadata: { contentType: check.type, cacheControl: "public, max-age=31536000, immutable" },
  });
  const { error } = await s.supabase.from("reviews").update({ photo_url: key }).eq("id", review.id);
  if (error) {
    await env.ASSETS_BUCKET.delete(key);
    return json(502, { error: "Couldn't attach the photo. Try again." });
  }
  if (review.photo_url && isReviewPhotoOf(review.photo_url, review.id)) await env.ASSETS_BUCKET.delete(review.photo_url);
  return json(201, { photoUrl: key });
};

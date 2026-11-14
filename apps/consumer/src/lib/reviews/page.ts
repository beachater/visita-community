// Reviews a page at a time (BEA-18). The list is read newest first in pages
// of PAGE_SIZE with a (created_at, id) cursor, so cafes with any number of
// reviews can be read to the end. The count and average come from the
// database (venue_review_summary), never from the rows on screen, and the
// signed-in visitor's own review is read on its own, so it shows however old
// it is and whether or not a moderator hid it.

export const PAGE_SIZE = 20;

export type ReviewRow = {
  id: string;
  author_id: string;
  rating: number;
  body: string | null;
  photo_url: string | null;
  status: "visible" | "hidden";
  created_at: string;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
  review_replies: { body: string; created_at: string } | null;
};

export type ReviewSummary = { average: number | null; count: number };

export type ReviewPage = { reviews: ReviewRow[]; nextCursor: string | null };

export type FirstReviewPage = ReviewPage & { summary: ReviewSummary; own: ReviewRow | null };

export const REVIEW_COLUMNS =
  "id, author_id, rating, body, photo_url, status, created_at, profiles(display_name, avatar_url), review_replies(body, created_at)" as const;

type Cursor = { createdAt: string; id: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Postgres timestamptz as PostgREST returns it, e.g. 2026-11-14T03:04:05.123456+00:00.
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

/** Opaque cursor for the page after `row`. */
export function encodeCursor(row: Pick<ReviewRow, "created_at" | "id">): string {
  return `${row.created_at}_${row.id}`;
}

/** Parses a cursor from the URL. Anything malformed is rejected, since it ends up in a filter. */
export function decodeCursor(raw: string | null | undefined): Cursor | null {
  if (!raw) return null;
  const at = raw.lastIndexOf("_");
  if (at < 0) return null;
  const createdAt = raw.slice(0, at);
  const id = raw.slice(at + 1);
  if (!TIMESTAMP.test(createdAt) || !UUID.test(id) || Number.isNaN(Date.parse(createdAt))) return null;
  return { createdAt, id };
}

/** PostgREST `or` filter for rows strictly after the cursor in (created_at desc, id desc) order. */
export function afterCursorFilter(cursor: Cursor): string {
  const at = `"${cursor.createdAt}"`;
  return `created_at.lt.${at},and(created_at.eq.${at},id.lt.${cursor.id})`;
}

/** Splits a PAGE_SIZE + 1 read into the page and the cursor for the next one. */
export function splitPage(rows: ReviewRow[], size = PAGE_SIZE): ReviewPage {
  if (rows.length <= size) return { reviews: rows, nextCursor: null };
  const reviews = rows.slice(0, size);
  return { reviews, nextCursor: encodeCursor(reviews[reviews.length - 1]!) };
}

export function toSummary(row: { average: number | string | null; review_count: number } | null | undefined): ReviewSummary {
  const count = row?.review_count ?? 0;
  const average = count > 0 && row?.average != null ? Math.round(Number(row.average) * 10) / 10 : null;
  return { average, count };
}

export type ReviewsClient = import("../auth/supabase-server").ServerSupabase;

export class ReviewsUnavailable extends Error {}

/** Visible reviews after `cursor`, newest first, leaving out the visitor's own (shown separately). */
export async function loadReviewPage(
  supabase: ReviewsClient,
  venueId: string,
  userId: string | null,
  cursor: string | null = null,
  size = PAGE_SIZE,
): Promise<ReviewPage> {
  let query = supabase.from("reviews").select(REVIEW_COLUMNS).eq("venue_id", venueId).eq("status", "visible");
  if (userId) query = query.neq("author_id", userId);
  const after = decodeCursor(cursor);
  if (cursor && !after) throw new RangeError("Bad review cursor.");
  if (after) query = query.or(afterCursorFilter(after));
  const { data, error } = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(size + 1);
  if (error) throw new ReviewsUnavailable("Couldn't load reviews.");
  return splitPage((data ?? []) as ReviewRow[], size);
}

/** Everything the first screen of reviews needs: the numbers, your own review and the first page. */
export async function loadFirstReviewPage(
  supabase: ReviewsClient,
  venueId: string,
  userId: string | null,
  size = PAGE_SIZE,
): Promise<FirstReviewPage> {
  const ownQuery = userId
    ? supabase.from("reviews").select(REVIEW_COLUMNS).eq("venue_id", venueId).eq("author_id", userId).maybeSingle()
    : Promise.resolve({ data: null, error: null });
  const [summary, own, page] = await Promise.all([
    supabase.rpc("venue_review_summary", { p_venue_id: venueId }),
    ownQuery,
    loadReviewPage(supabase, venueId, userId, null, size),
  ]);
  if (summary.error || own.error) throw new ReviewsUnavailable("Couldn't load reviews.");
  const summaryRow = Array.isArray(summary.data) ? summary.data[0] : summary.data;
  return { ...page, summary: toSummary(summaryRow as Parameters<typeof toSummary>[0]), own: (own.data as ReviewRow | null) ?? null };
}

/** A review as /api/reviews sends it to the browser. */
export type ClientReview = {
  id: string;
  name: string;
  avatarUrl: string | null;
  rating: number;
  body: string | null;
  photoUrl: string | null;
  createdAt: string;
  own: boolean;
  hidden: boolean;
  reply: { body: string; created_at: string } | null;
};

export function toClientReview(row: ReviewRow, own: boolean): ClientReview {
  return {
    id: row.id,
    name: row.profiles?.display_name ?? (own ? "You" : "Visita member"),
    avatarUrl: row.profiles?.avatar_url ?? null,
    rating: row.rating,
    body: row.body,
    photoUrl: row.photo_url,
    createdAt: row.created_at,
    own,
    hidden: row.status === "hidden",
    reply: row.review_replies,
  };
}

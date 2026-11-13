import type { ClientReview } from "./page";

export type MoreReviews = { reviews: ClientReview[]; nextCursor: string | null };

/** Fetches the page of reviews after `cursor` from /api/reviews. */
export async function fetchMoreReviews(slug: string, cursor: string, signal?: AbortSignal): Promise<MoreReviews> {
  const response = await fetch(`/api/reviews?slug=${encodeURIComponent(slug)}&cursor=${encodeURIComponent(cursor)}`, { signal });
  const body = (await response.json().catch(() => ({}))) as Partial<MoreReviews> & { error?: string };
  if (!response.ok || !Array.isArray(body.reviews)) throw new Error(body.error ?? "Couldn't load more reviews. Try again.");
  return { reviews: body.reviews, nextCursor: body.nextCursor ?? null };
}

/** Appends a page, skipping any review already shown (a page can overlap if reviews change between reads). */
export function appendReviews(shown: ClientReview[], more: ClientReview[]): ClientReview[] {
  const seen = new Set(shown.map((review) => review.id));
  return [...shown, ...more.filter((review) => !seen.has(review.id))];
}

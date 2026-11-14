import { useState } from "react";
import { Button } from "@visita/ui/button";
import { appendReviews, fetchMoreReviews } from "../../lib/reviews/more";
import type { ClientReview } from "../../lib/reviews/page";
import { ReviewCard } from "./ReviewCard";

// "Show more reviews" under the first page on a cafe page (BEA-18): reads the
// next page from /api/reviews and adds it below, until there are no more.
export function MoreReviews({ slug, cursor: initialCursor }: { slug: string; cursor: string }) {
  const [reviews, setReviews] = useState<ClientReview[]>([]);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const page = await fetchMoreReviews(slug, cursor);
      setReviews((shown) => appendReviews(shown, page.reviews));
      setCursor(page.nextCursor);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't load more reviews. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {cursor && (
        <Button type="button" variant="outline" onClick={loadMore} disabled={loading} className="justify-self-center">
          {loading ? "Loading…" : "Show more reviews"}
        </Button>
      )}
    </>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";
import { BottomSheet } from "@visita/ui/bottom-sheet";
import { Button } from "@visita/ui/button";
import { cn } from "@visita/ui/utils";
import { appendReviews, fetchMoreReviews } from "../../lib/reviews/more";
import type { ClientReview } from "../../lib/reviews/page";
import { ReviewSheet } from "./ReviewSheet";

type Payload = {
  signedIn: boolean;
  summary: { average: number | null; count: number };
  own: { rating: number; body: string | null; photoUrl: string | null } | null;
  ownReview: ClientReview | null;
  reviews: ClientReview[];
  nextCursor: string | null;
};

export function WalkthroughReviews({ slug, cafeName, open, onOpenChange }: { slug: string; cafeName: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    fetch(`/api/reviews?slug=${encodeURIComponent(slug)}`, { signal: ctrl.signal })
      .then(async (response) => {
        const body = await response.json() as Payload & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Couldn't load reviews. Try again.");
        return body as Payload;
      })
      .then((payload) => { setData(payload); setError(null); setMoreError(null); })
      .catch((cause: unknown) => {
        if (!ctrl.signal.aborted) setError(cause instanceof Error ? cause.message : "Couldn't load reviews. Try again.");
      });
    return () => ctrl.abort();
  }, [open, slug, revision]);

  // Count and average come from the database (BEA-18), not from the reviews loaded so far.
  const count = data?.summary.count ?? 0;
  const average = data?.summary.average != null ? data.summary.average.toFixed(1) : null;
  const shown = data ? [...(data.ownReview ? [data.ownReview] : []), ...data.reviews] : [];

  async function loadMore() {
    const cursor = data?.nextCursor;
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await fetchMoreReviews(slug, cursor);
      // Ignore a page that arrives after the list was reloaded.
      setData((current) => current?.nextCursor === cursor ? { ...current, reviews: appendReviews(current.reviews, page.reviews), nextCursor: page.nextCursor } : current);
    } catch (cause) {
      setMoreError(cause instanceof Error ? cause.message : "Couldn't load more reviews. Try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Reviews" description={cafeName}>
      <div className="grid gap-4 pt-1">
        {error && <p role="alert" className="text-sm text-destructive">{error} <button type="button" className="underline" onClick={refresh}>Retry</button></p>}
        {!data && !error && <p className="text-sm text-muted-foreground">Loading reviews…</p>}
        {data && <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{average ? `★ ${average} · ${count} ${count === 1 ? "review" : "reviews"}` : "No reviews yet. Be the first."}</p>
            <ReviewSheet slug={slug} cafeName={cafeName} signedIn={data.signedIn} loginHref={`/auth/login?next=${encodeURIComponent(`/cafe/${slug}?review=1`)}`} existing={data.own} onSaved={refresh} />
          </div>
          {shown.map((review) => (
            <article key={review.id} className={cn("grid gap-2 rounded-card border bg-card p-4", review.own && "border-primary/40")}>
              <div className="flex items-start justify-between gap-2">
                <div><p className="font-medium">{review.name}{review.own && <span className="ml-2 text-xs text-primary">Your review</span>}</p><p className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }).format(new Date(review.createdAt))}</p></div>
                <span className="flex shrink-0 text-rating" aria-label={`${review.rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={cn("size-3.5", i <= review.rating ? "fill-current" : "opacity-30")} aria-hidden="true" />)}</span>
              </div>
              {review.hidden && <p className="text-sm text-muted-foreground">Hidden by a moderator. Only you can see it.</p>}
              {review.body && <p className="whitespace-pre-line text-sm">{review.body}</p>}
              {review.photoUrl && <a href={`/assets/${review.photoUrl}`} target="_blank" rel="noopener"><img src={`/assets/${review.photoUrl}`} alt={`Photo from ${review.name}'s review`} className="max-h-56 rounded-2xl object-cover" loading="lazy" /></a>}
              {review.reply && <div className="border-l-2 border-primary/30 pl-3"><p className="text-xs font-bold">Reply from the cafe</p><p className="whitespace-pre-line text-sm">{review.reply.body}</p></div>}
            </article>
          ))}
          {moreError && <p role="alert" className="text-sm text-destructive">{moreError}</p>}
          {data.nextCursor && <Button type="button" variant="outline" onClick={loadMore} disabled={loadingMore} className="justify-self-center">{loadingMore ? "Loading…" : "Show more reviews"}</Button>}
        </>}
      </div>
    </BottomSheet>
  );
}

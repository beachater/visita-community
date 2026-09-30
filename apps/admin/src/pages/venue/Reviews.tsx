import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Button } from "@visita/ui/button";
import { Textarea } from "@visita/ui/textarea";
import { cn } from "@visita/ui/utils";
import { CONSUMER_URL, supabase } from "@/lib/supabase";
import { useVenue } from "./VenueLayout";

// PRD 4.4 review responses: owners reply publicly to reviews of their cafe,
// one reply per review, shown under it on the listing.

interface ReviewRow {
  id: string;
  rating: number;
  body: string | null;
  photo_url: string | null;
  created_at: string;
  author: string;
  reply: string | null;
}

const date = (iso: string) => new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }).format(new Date(iso));

function ReplyBox({ review, onSaved }: { review: ReviewRow; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(review.reply ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const body = text.trim();
    if (!body) return;
    setSaving(true);
    const { error } = review.reply
      ? await supabase.from("review_replies").update({ body }).eq("review_id", review.id)
      : await supabase.from("review_replies").insert({ review_id: review.id, body });
    setSaving(false);
    if (error) {
      toast.error("Couldn't post your reply. Try again.");
      return;
    }
    setEditing(false);
    toast.success(review.reply ? "Reply updated" : "Reply posted");
    onSaved();
  };

  const remove = async () => {
    const { error } = await supabase.from("review_replies").delete().eq("review_id", review.id);
    if (error) toast.error("Couldn't remove the reply.");
    else {
      setText("");
      onSaved();
    }
  };

  if (!editing && review.reply)
    return (
      <div className="grid gap-2 rounded-lg bg-muted p-3 text-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Your reply</p>
        <p className="whitespace-pre-line">{review.reply}</p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void remove()}>
            Remove
          </Button>
        </div>
      </div>
    );
  if (!editing)
    return (
      <Button variant="outline" size="sm" className="w-fit" onClick={() => setEditing(true)}>
        Reply publicly
      </Button>
    );
  return (
    <div className="grid gap-2">
      <Textarea aria-label="Your public reply" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder="Thank them, or answer their point. Everyone can read this." />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void save()} disabled={saving || !text.trim()}>
          {saving ? "Posting…" : "Post reply"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function Reviews() {
  const { venue } = useVenue();
  const [reviews, setReviews] = useState<ReviewRow[] | null>(null);

  const load = useCallback(async () => {
    const r = await supabase
      .from("reviews")
      .select("id, rating, body, photo_url, created_at, profiles(display_name), review_replies(body)")
      .eq("venue_id", venue.id)
      .eq("status", "visible")
      .order("created_at", { ascending: false })
      .limit(100);
    setReviews(
      (r.data ?? []).map((x) => ({
        id: x.id,
        rating: x.rating,
        body: x.body,
        photo_url: x.photo_url,
        created_at: x.created_at,
        author: x.profiles?.display_name ?? "Visita member",
        reply: x.review_replies?.body ?? null,
      })),
    );
  }, [venue.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const unanswered = reviews?.filter((r) => !r.reply).length ?? 0;
  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-lg font-semibold">Reviews</h2>
        <p className="text-sm text-muted-foreground">
          {reviews === null ? "Loading…" : reviews.length === 0 ? "No reviews yet." : `${reviews.length} ${reviews.length === 1 ? "review" : "reviews"}, ${unanswered} without a reply.`}
        </p>
      </div>
      <ul className="grid gap-3">
        {reviews?.map((r) => (
          <li key={r.id} className="grid gap-3 rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{r.author}</p>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex text-rating" role="img" aria-label={`${r.rating} out of 5 stars`}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className={cn("size-3.5", i <= r.rating ? "fill-current" : "opacity-30")} aria-hidden="true" />
                  ))}
                </span>
                {date(r.created_at)}
              </p>
            </div>
            {r.body && <p className="whitespace-pre-line text-sm">{r.body}</p>}
            {r.photo_url && <img src={`${CONSUMER_URL}/assets/${r.photo_url}`} alt={`Photo from ${r.author}'s review`} className="max-h-40 w-fit rounded-lg border object-cover" loading="lazy" />}
            <ReplyBox review={r} onSaved={() => void load()} />
          </li>
        ))}
      </ul>
    </div>
  );
}

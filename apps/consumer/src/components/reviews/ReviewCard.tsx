import { EyeOff, Star } from "lucide-react";
import { cn } from "@visita/ui/utils";
import type { ClientReview } from "../../lib/reviews/page";

const dateFormat = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });

// One review. The author's own review is marked, and if a moderator hid it,
// only they see it, with a notice saying so. Rendered on the server for the
// first page and in the browser for "Show more reviews".
export function ReviewCard({ review }: { review: ClientReview }) {
  const { name, avatarUrl, rating, body, photoUrl, createdAt, own, hidden, reply } = review;
  return (
    <article className={cn("grid gap-2 rounded-card bg-card shadow-card p-4", own && "border-primary/40")}>
      <header className="flex items-center gap-3">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" width="36" height="36" className="size-9 rounded-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
        ) : (
          <span className="grid size-9 place-items-center rounded-full bg-muted font-medium" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{name}{own && <span className="ml-2 text-xs font-bold uppercase tracking-wide text-primary">Your review</span>}</p>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex text-rating" role="img" aria-label={`${rating} out of 5 stars`}>
              {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={cn("size-3.5", i <= rating ? "fill-current" : "opacity-30")} aria-hidden="true" />)}
            </span>
            <time dateTime={createdAt}>{dateFormat.format(new Date(createdAt))}</time>
          </p>
        </div>
      </header>
      {hidden && (
        <p className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-sm">
          <EyeOff className="size-4 shrink-0" aria-hidden="true" /> Hidden by a moderator. Only you can see it.
        </p>
      )}
      {body && <p className="whitespace-pre-line text-sm leading-relaxed">{body}</p>}
      {photoUrl && (
        <a href={`/assets/${photoUrl}`} className="w-fit" target="_blank" rel="noopener">
          <img src={`/assets/${photoUrl}`} alt={`Photo from ${name}'s review`} className="max-h-56 rounded-2xl object-cover shadow-float" loading="lazy" />
        </a>
      )}
      {reply && (
        <div className="ml-4 grid gap-1 border-l-2 border-primary/30 pl-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Reply from the cafe</p>
          <p className="whitespace-pre-line text-sm leading-relaxed">{reply.body}</p>
        </div>
      )}
    </article>
  );
}

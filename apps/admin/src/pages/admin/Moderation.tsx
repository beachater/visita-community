import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Button } from "@visita/ui/button";
import { cn } from "@visita/ui/utils";
import { removeReviewPhoto } from "@/lib/api";
import { CONSUMER_URL, supabase } from "@/lib/supabase";

// PRD 4.5 review moderation: recent reviews, hide or unhide. Hiding keeps the
// review (the author still sees it, marked hidden); a photo that shouldn't be
// public is removed separately, since review photos are served by URL.

interface Row {
  id: string;
  rating: number;
  body: string | null;
  photo_url: string | null;
  status: "visible" | "hidden";
  created_at: string;
  author: string;
  venue: string;
}

type Show = "all" | "visible" | "hidden";

export function Moderation() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [show, setShow] = useState<Show>("all");
  // Removing a photo deletes the file, so it takes a second tap.
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(async () => {
    let q = supabase
      .from("reviews")
      .select("id, rating, body, photo_url, status, created_at, profiles(display_name), venues(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (show !== "all") q = q.eq("status", show);
    const { data } = await q;
    setRows(
      (data ?? []).map((r) => ({
        id: r.id,
        rating: r.rating,
        body: r.body,
        photo_url: r.photo_url,
        status: r.status,
        created_at: r.created_at,
        author: r.profiles?.display_name ?? "Visita member",
        venue: r.venues?.name ?? "Unknown venue",
      })),
    );
  }, [show]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (r: Row, status: Row["status"]) => {
    const { error } = await supabase.from("reviews").update({ status }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success(status === "hidden" ? "Review hidden" : "Review visible again");
    void load();
  };

  const dropPhoto = async (r: Row) => {
    if (confirming !== r.id) return setConfirming(r.id);
    setConfirming(null);
    try {
      await removeReviewPhoto(r.id);
      toast.success("Photo removed");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove the photo.");
    }
  };

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Reviews</h1>
          <p className="text-muted-foreground">The 100 most recent. Hidden reviews stay visible to their author, marked as hidden.</p>
        </div>
        <div role="group" aria-label="Show" className="inline-flex rounded-lg border bg-card p-0.5">
          {(["all", "visible", "hidden"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={show === s}
              onClick={() => setShow(s)}
              className={cn("rounded-md px-3 py-1.5 text-sm capitalize", show === s ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
            >
              {s}
            </button>
          ))}
        </div>
      </header>
      {rows === null && <p className="text-muted-foreground">Loading…</p>}
      {rows?.length === 0 && <p className="rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground">No reviews here.</p>}
      <ul className="grid gap-3">
        {rows?.map((r) => (
          <li key={r.id} className={cn("grid gap-2 rounded-xl border bg-card p-4", r.status === "hidden" && "opacity-70")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                {r.author} on {r.venue}
              </p>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex text-rating" role="img" aria-label={`${r.rating} out of 5 stars`}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className={cn("size-3.5", i <= r.rating ? "fill-current" : "opacity-30")} aria-hidden="true" />
                  ))}
                </span>
                {new Date(r.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}
                {r.status === "hidden" && <span className="rounded-full border px-2 py-0.5 font-medium">Hidden</span>}
              </p>
            </div>
            {r.body && <p className="whitespace-pre-line text-sm">{r.body}</p>}
            {r.photo_url && (
              <img src={`${CONSUMER_URL}/assets/${r.photo_url}`} alt={`Photo from ${r.author}'s review`} className="max-h-40 w-fit rounded-lg border object-cover" loading="lazy" />
            )}
            <div className="flex flex-wrap gap-2">
              {r.status === "visible" ? (
                <Button variant="outline" size="sm" onClick={() => void setStatus(r, "hidden")}>
                  Hide
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => void setStatus(r, "visible")}>
                  Unhide
                </Button>
              )}
              {r.photo_url && (
                <Button variant="ghost" size="sm" onClick={() => void dropPhoto(r)}>
                  {confirming === r.id ? "Tap again to delete the photo" : "Remove photo"}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

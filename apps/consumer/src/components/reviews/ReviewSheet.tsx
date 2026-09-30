import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Star, Trash2, X } from "lucide-react";
import { BottomSheet } from "@visita/ui/bottom-sheet";
import { Button } from "@visita/ui/button";
import { Label } from "@visita/ui/label";
import { Textarea } from "@visita/ui/textarea";
import { cn } from "@visita/ui/utils";
import { MAX_REVIEW_CHARS } from "@/lib/reviews/input";
import { WRITE_REVIEW_EVENT } from "@/lib/reviews/open";
import { resizeToJpeg } from "@/lib/uploads/resize";

// PRD 4.3: write or edit your review of a cafe: 1–5 stars, text and an
// optional photo. Signed-out visitors can start writing; the draft is kept
// on the device while they sign in and the sheet reopens when they're back.

interface Existing {
  rating: number;
  body: string | null;
  photoUrl: string | null;
}

interface Props {
  slug: string;
  cafeName: string;
  signedIn: boolean;
  loginHref: string;
  existing: Existing | null;
}

interface Draft {
  rating: number;
  body: string;
}

const draftKey = (slug: string) => `visita:review-draft:${slug}`;

function readDraft(slug: string): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(draftKey(slug)) ?? "null");
    return d && typeof d.rating === "number" && typeof d.body === "string" ? d : null;
  } catch {
    return null;
  }
}

function writeDraft(slug: string, draft: Draft | null) {
  try {
    if (draft) localStorage.setItem(draftKey(slug), JSON.stringify(draft));
    else localStorage.removeItem(draftKey(slug));
  } catch {
    // Storage blocked: the draft lives only while the page is open.
  }
}

async function send(method: "POST" | "PATCH" | "DELETE", body: unknown): Promise<{ ok: boolean; data: { id?: string; error?: string } }> {
  const res = await fetch("/api/reviews", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
  return { ok: res.ok, data };
}

export function ReviewSheet({ slug, cafeName, signedIn, loginHref, existing }: Props) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [body, setBody] = useState(existing?.body ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "deleting">("idle");
  const [error, setError] = useState<string | null>(null);
  // Set once the review is saved but its photo isn't: retrying only re-sends the photo.
  const [savedId, setSavedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textId = useId();

  // Reopen with the draft after sign-in, or when asked to (?review=1, the walkthrough panel).
  useEffect(() => {
    const draft = readDraft(slug);
    if (draft && !existing) {
      setRating(draft.rating);
      setBody(draft.body);
    }
    const asked = new URLSearchParams(window.location.search).get("review") === "1";
    if (asked || (draft && signedIn)) setOpen(true);
    if (asked) {
      const url = new URL(window.location.href);
      url.searchParams.delete("review");
      history.replaceState(history.state, "", url);
    }
    const onOpen = (e: Event) => {
      if ((e as CustomEvent<{ slug: string }>).detail?.slug === slug) setOpen(true);
    };
    window.addEventListener(WRITE_REVIEW_EVENT, onOpen);
    const island = document.getElementById("reviews");
    if (island) island.dataset.ready = slug;
    return () => window.removeEventListener(WRITE_REVIEW_EVENT, onOpen);
  }, [slug, signedIn, existing]);

  // Keep what's typed, so closing the sheet or a failed request never loses it.
  useEffect(() => {
    if (!existing && (rating > 0 || body)) writeDraft(slug, { rating, body });
  }, [slug, existing, rating, body]);

  const uploadPhoto = async (reviewId: string): Promise<boolean> => {
    if (!photo) return true;
    try {
      const jpeg = await resizeToJpeg(photo);
      const res = await fetch(`/api/uploads/review-photo?review=${encodeURIComponent(reviewId)}`, {
        method: "POST",
        headers: { "content-type": "image/jpeg" },
        body: jpeg,
      });
      if (res.ok) return true;
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(`Your review is saved, but the photo didn't upload: ${data.error ?? "try again"}.`);
    } catch {
      setError("Your review is saved, but the photo didn't upload. Check your connection and try again.");
    }
    return false;
  };

  const finish = () => {
    writeDraft(slug, null);
    window.location.reload();
  };

  const submit = async () => {
    setError(null);
    if (rating < 1) {
      setError("Pick a rating from 1 to 5 stars.");
      return;
    }
    if (!signedIn) {
      writeDraft(slug, { rating, body });
      window.location.assign(loginHref);
      return;
    }
    setStatus("saving");
    try {
      let id = savedId;
      if (!id) {
        const { ok, data } = await send(existing ? "PATCH" : "POST", { slug, rating, body, removePhoto: removePhoto && !photo });
        if (!ok || !data.id) {
          setError(data.error ?? "Couldn't save your review. Try again.");
          return;
        }
        id = data.id;
        setSavedId(id);
      }
      if (await uploadPhoto(id)) finish();
    } catch {
      setError("You're offline. Your review is kept here; try again when you're connected.");
    } finally {
      setStatus("idle");
    }
  };

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setStatus("deleting");
    setError(null);
    try {
      const { ok, data } = await send("DELETE", { slug });
      if (ok) finish();
      else setError(data.error ?? "Couldn't delete your review. Try again.");
    } catch {
      setError("You're offline. Try again when you're connected.");
    } finally {
      setStatus("idle");
      setConfirmDelete(false);
    }
  };

  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!photo) return setPreview(null);
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const shownPhoto = preview ?? (existing?.photoUrl && !removePhoto ? `/assets/${existing.photoUrl}` : null);

  const busy = status !== "idle";
  const label = existing ? "Edit your review" : "Write a review";

  return (
    <BottomSheet
      open={open}
      onOpenChange={setOpen}
      title={existing ? "Your review" : `Review ${cafeName}`}
      trigger={
        <Button variant={existing ? "outline" : "default"} className="w-full sm:w-auto">
          {label}
        </Button>
      }
      footer={
        <div className="grid gap-2">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            {existing && (
              <Button variant="outline" onClick={remove} disabled={busy} aria-live="polite">
                <Trash2 /> {confirmDelete ? "Tap again to delete" : "Delete"}
              </Button>
            )}
            <Button className="flex-1" onClick={submit} disabled={busy}>
              {status === "saving"
                ? "Saving…"
                : savedId
                  ? "Try the photo again"
                  : !signedIn
                    ? "Sign in to post"
                    : existing
                      ? "Save changes"
                      : "Post review"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-5 py-1">
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Your rating</legend>
          <div className="flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                onClick={() => setRating(n)}
                className="grid size-11 place-items-center rounded-md text-rating hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Star className={cn("size-8", n <= rating ? "fill-current" : "opacity-40")} aria-hidden="true" />
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-2">
          <Label htmlFor={textId}>What was it like? (optional)</Label>
          <Textarea
            id={textId}
            value={body}
            maxLength={MAX_REVIEW_CHARS}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Seating, noise, Wi-Fi, outlets, the coffee…"
            className="min-h-32"
          />
        </div>

        <div className="grid gap-2">
          <span className="text-sm font-medium">Photo (optional)</span>
          {shownPhoto ? (
            <div className="relative w-fit">
              <img src={shownPhoto} alt="Your review photo" className="max-h-48 rounded-lg border object-cover" />
              <Button
                variant="secondary"
                size="icon-sm"
                className="absolute right-1.5 top-1.5"
                aria-label="Remove photo"
                onClick={() => {
                  setPhoto(null);
                  setRemovePhoto(true);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                <X />
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="w-fit" onClick={() => fileRef.current?.click()}>
              <ImagePlus /> Add a photo
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
          {!signedIn && photo && <p className="text-xs text-muted-foreground">Photos aren't kept while you sign in; add it again after.</p>}
        </div>
      </div>
    </BottomSheet>
  );
}

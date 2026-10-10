import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { Button } from "@visita/ui/button";
import { Input } from "@visita/ui/input";
import { Label } from "@visita/ui/label";
import { Textarea } from "@visita/ui/textarea";
import { setEventPhoto } from "@/lib/api";
import { CONSUMER_URL, supabase } from "@/lib/supabase";
import { eventWhen, isoToManilaInput, manilaInputToIso } from "./event-time";
import { useVenue } from "./VenueLayout";

// PRD 4.4 events and promotions. Visitors see current and upcoming ones on
// the cafe page and in the walkthrough.

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  photo_url: string | null;
}

interface Draft {
  id: string | null;
  title: string;
  description: string;
  starts: string;
  ends: string;
}

const range = (e: EventRow) => {
  const fmt = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
  return `${fmt.format(new Date(e.starts_at))} – ${fmt.format(new Date(e.ends_at))}`;
};

const WHEN_LABEL = { now: "Happening now", upcoming: "Upcoming", past: "Ended" } as const;

function EventForm({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const { venue } = useVenue();
  const [d, setD] = useState(draft);
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    const starts = manilaInputToIso(d.starts);
    const ends = manilaInputToIso(d.ends);
    if (!d.title.trim()) return setError("Give the event a title.");
    if (!starts || !ends) return setError("Set when it starts and ends.");
    if (ends <= starts) return setError("It has to end after it starts.");
    setError(null);
    setSaving(true);
    const fields = { title: d.title.trim(), description: d.description.trim() || null, starts_at: starts, ends_at: ends };
    const result = d.id
      ? await supabase.from("venue_events").update(fields).eq("id", d.id).select("id").single()
      : await supabase.from("venue_events").insert({ venue_id: venue.id, ...fields }).select("id").single();
    if (result.error || !result.data) {
      setSaving(false);
      return setError("Couldn't save the event. Try again.");
    }
    if (photo) {
      try {
        await setEventPhoto(result.data.id, photo);
      } catch (e) {
        toast.error(`Event saved, but the photo didn't upload: ${e instanceof Error ? e.message : "try again"}.`);
      }
    }
    setSaving(false);
    toast.success(d.id ? "Event updated" : "Event posted");
    onSaved();
    onClose();
  };

  return (
    <div className="grid gap-3 rounded-card border bg-card shadow-card p-5">
      <div className="grid gap-1.5">
        <Label htmlFor="ev-title">Title</Label>
        <Input id="ev-title" value={d.title} maxLength={120} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Open mic night" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ev-desc">Details (optional)</Label>
        <Textarea id="ev-desc" value={d.description} maxLength={2000} onChange={(e) => setD({ ...d, description: e.target.value })} placeholder="What's happening, any promo, who it's for" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="ev-start">Starts</Label>
          <Input id="ev-start" type="datetime-local" value={d.starts} onChange={(e) => setD({ ...d, starts: e.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ev-end">Ends</Label>
          <Input id="ev-end" type="datetime-local" value={d.ends} onChange={(e) => setD({ ...d, ends: e.target.value })} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Times are Philippine time.</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <ImagePlus /> {photo ? photo.name : "Add a photo (optional)"}
        </Button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : d.id ? "Save changes" : "Post event"}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function EventsEditor() {
  const { venue } = useVenue();
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const now = new Date();

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("venue_events")
      .select("id, title, description, starts_at, ends_at, photo_url")
      .eq("venue_id", venue.id)
      .order("starts_at", { ascending: false })
      .limit(50);
    setEvents(data ?? []);
  }, [venue.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (e: EventRow) => {
    if (e.photo_url) await setEventPhoto(e.id, null).catch(() => undefined);
    const { error } = await supabase.from("venue_events").delete().eq("id", e.id);
    if (error) toast.error("Couldn't delete the event.");
    else toast.success("Event deleted");
    await load();
  };

  const blank = (): Draft => {
    const start = new Date(Date.now() + 86_400_000);
    start.setUTCMinutes(0, 0, 0);
    return { id: null, title: "", description: "", starts: isoToManilaInput(start.toISOString()), ends: isoToManilaInput(new Date(start.getTime() + 3 * 3_600_000).toISOString()) };
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Events and promotions</h2>
          <p className="text-sm text-muted-foreground">Current and upcoming events show on your listing and in your 3D walkthrough.</p>
        </div>
        {!draft && (
          <Button onClick={() => setDraft(blank())}>
            <Plus /> New event
          </Button>
        )}
      </div>
      {draft && <EventForm draft={draft} onClose={() => setDraft(null)} onSaved={() => void load()} />}
      {events === null && <p className="text-muted-foreground">Loading…</p>}
      {events?.length === 0 && !draft && <p className="rounded-card border border-dashed bg-card shadow-card p-8 text-center text-muted-foreground">No events yet.</p>}
      <ul className="grid gap-3">
        {events?.map((e) => {
          const when = eventWhen(e.starts_at, e.ends_at, now);
          return (
            <li key={e.id} className={`flex flex-wrap items-start justify-between gap-3 rounded-card border bg-card shadow-card p-4 ${when === "past" ? "opacity-60" : ""}`}>
              <div className="flex min-w-0 gap-3">
                {e.photo_url && <img src={`${CONSUMER_URL}/assets/${e.photo_url}`} alt="" className="size-16 shrink-0 rounded-lg object-cover" loading="lazy" />}
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{WHEN_LABEL[when]}</p>
                  <p className="font-medium">{e.title}</p>
                  <p className="text-sm text-muted-foreground">{range(e)}</p>
                  {e.description && <p className="mt-1 line-clamp-2 text-sm">{e.description}</p>}
                </div>
              </div>
              <div className="flex gap-1">
                {when !== "past" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDraft({ id: e.id, title: e.title, description: e.description ?? "", starts: isoToManilaInput(e.starts_at), ends: isoToManilaInput(e.ends_at) })
                    }
                  >
                    Edit
                  </Button>
                )}
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${e.title}`} onClick={() => void remove(e)}>
                  <Trash2 />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@visita/ui/button";
import { Textarea } from "@visita/ui/textarea";
import { supabase } from "@/lib/supabase";
import { useVenue } from "./VenueLayout";

// "About your cafe" (approved 2026-11-14): the owner's own short description,
// shown after the 3D view on the visitor site and labelled "Written by the
// cafe". Saved straight away through owner_update_listing, like menu and hours.

export const MAX_DESCRIPTION = 400;

export function DescriptionEditor() {
  const { venue, reload } = useVenue();
  const [text, setText] = useState(venue.description ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = text.trim() !== (venue.description ?? "");
  const tooLong = text.trim().length > MAX_DESCRIPTION;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("owner_update_listing", { p_venue_id: venue.id, p_patch: { description: text.trim() || null } });
    setSaving(false);
    if (error) {
      toast.error("Couldn't save the description. Try again.");
      return;
    }
    toast.success(text.trim() ? "Description saved. It's live on your page." : "Description removed.");
    await reload();
  };

  return (
    <section aria-labelledby="about-h" className="grid gap-3 rounded-card bg-card p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="about-h" className="text-lg font-semibold">About your cafe</h2>
        <span className="text-xs text-muted-foreground">Shown under your 3D walkthrough</span>
      </div>
      <label htmlFor="about-text" className="text-sm text-muted-foreground">In a sentence or two: what's it like, and who is it for?</label>
      <Textarea id="about-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} aria-invalid={tooLong} className="rounded-2xl" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={tooLong ? "text-xs font-semibold text-destructive" : "text-xs text-muted-foreground"} aria-live="polite">
          {text.trim().length} / {MAX_DESCRIPTION} · plain text
        </span>
        <Button className="rounded-full" onClick={() => void save()} disabled={!dirty || tooLong || saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">Goes live right away, like your menu and hours. Visita's team can edit or hide it if it breaks the listing rules.</p>
    </section>
  );
}

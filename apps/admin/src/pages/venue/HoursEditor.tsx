import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@visita/ui/button";
import { Input } from "@visita/ui/input";
import { DAYS, hoursFromRows, isOvernight, rowsFromHours, type DayRow } from "./hours-form";
import { useVenue } from "./VenueLayout";
import { supabase } from "@/lib/supabase";

// PRD 4.4: opening hours per day, including closing after midnight and closed
// days. "Not sure" leaves a day unknown, so the public site shows no
// open/closed pill rather than a guess.

export function HoursEditor() {
  const { venue, reload } = useVenue();
  const [rows, setRows] = useState<DayRow[]>(() => rowsFromHours(venue.hours));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const update = (i: number, patch: Partial<DayRow>) => {
    setRows((rs) =>
      rs.map((r, j) => {
        if (j !== i) return r;
        const next = { ...r, ...patch };
        return { ...next, overnight: next.state === "open" && isOvernight(next.opens, next.closes) };
      }),
    );
    setDirty(true);
  };

  const copyToAll = (i: number) => {
    const src = rows[i]!;
    setRows((rs) => rs.map((r) => ({ ...r, state: src.state, opens: src.opens, closes: src.closes, overnight: src.overnight })));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("owner_update_listing", { p_venue_id: venue.id, p_patch: { hours: hoursFromRows(rows) } });
    setSaving(false);
    if (error) {
      toast.error("Couldn't save the hours. Try again.");
      return;
    }
    setDirty(false);
    toast.success("Opening hours saved");
    await reload();
  };

  return (
    <section aria-labelledby="hours-h" className="grid gap-3">
      <div>
        <h2 id="hours-h" className="text-lg font-semibold">
          Opening hours
        </h2>
        <p className="text-sm text-muted-foreground">If you close after midnight, set the closing time for the next morning, like 6:00 PM to 2:00 AM.</p>
      </div>
      <div className="divide-y overflow-hidden rounded-card border bg-card shadow-card">
        {rows.map((r, i) => {
          const label = DAYS[i]!.label;
          return (
            <div key={r.day} className="grid items-center gap-2 px-4 py-3 sm:grid-cols-[7rem_9rem_1fr_auto]">
              <span className="font-medium">{label}</span>
              <select
                aria-label={`${label}: open or closed`}
                value={r.state}
                onChange={(e) => update(i, { state: e.target.value as DayRow["state"] })}
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="unknown">Not sure</option>
              </select>
              {r.state === "open" ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Input type="time" aria-label={`${label} opens`} value={r.opens} onChange={(e) => update(i, { opens: e.target.value })} className="w-32" />
                  <span>to</span>
                  <Input type="time" aria-label={`${label} closes`} value={r.closes} onChange={(e) => update(i, { closes: e.target.value })} className="w-32" />
                  {r.overnight && <span className="text-xs text-muted-foreground">closes the next day</span>}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">{r.state === "closed" ? "Closed all day" : "Visitors won't see hours for this day"}</span>
              )}
              <Button variant="ghost" size="sm" onClick={() => copyToAll(i)}>
                Copy to all days
              </Button>
            </div>
          );
        })}
      </div>
      <div>
        <Button onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save hours"}
        </Button>
      </div>
    </section>
  );
}

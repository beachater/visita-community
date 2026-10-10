import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { currentOccupancy, OCCUPANCY_LABEL, type OccupancyLevel, type OccupancyRow } from "@visita/shared-types";
import { Button } from "@visita/ui/button";
import { cn } from "@visita/ui/utils";
import { supabase } from "@/lib/supabase";

// PRD 4.4 occupancy: one tap, shown on the cafe page and walkthrough, and
// cleared automatically three hours later so it never goes stale.

const LEVELS: { level: OccupancyLevel; hint: string }[] = [
  { level: "quiet", hint: "Plenty of seats" },
  { level: "moderate", hint: "Some seats free" },
  { level: "full", hint: "Hard to find a seat" },
];

const clock = (iso: string) => new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(iso));

export function OccupancyButtons({ venueId }: { venueId: string }) {
  const [row, setRow] = useState<OccupancyRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    const { data } = await supabase.from("venue_occupancy").select("level, set_at, expires_at").eq("venue_id", venueId).maybeSingle();
    setRow(data);
  }, [venueId]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  const set = async (level: OccupancyLevel | null) => {
    setBusy(true);
    const { error } = await supabase.rpc("set_occupancy", { p_venue_id: venueId, p_level: level as OccupancyLevel });
    setBusy(false);
    if (error) {
      toast.error("Couldn't update. Try again.");
      return;
    }
    setNow(new Date());
    await load();
  };

  const current = currentOccupancy(row, now);
  return (
    <section aria-labelledby="occ-h" className="grid gap-3 rounded-card border bg-card shadow-card p-5">
      <div>
        <h2 id="occ-h" className="text-lg font-semibold">
          How busy is it right now?
        </h2>
        <p className="text-sm text-muted-foreground">
          {current && row
            ? `Showing "${OCCUPANCY_LABEL[current.level]}", set ${current.ago}. It clears at ${clock(row.expires_at)}.`
            : "Nothing showing. Tap one and visitors see it for the next three hours."}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Occupancy">
        {LEVELS.map(({ level, hint }) => (
          <Button
            key={level}
            variant={current?.level === level ? "default" : "outline"}
            className={cn("h-auto flex-col items-start gap-0.5 py-3")}
            aria-pressed={current?.level === level}
            disabled={busy}
            onClick={() => void set(level)}
          >
            <span className="text-base font-semibold">{OCCUPANCY_LABEL[level]}</span>
            <span className="text-xs font-normal opacity-80">{hint}</span>
          </Button>
        ))}
      </div>
      {current && (
        <Button variant="ghost" size="sm" className="w-fit" disabled={busy} onClick={() => void set(null)}>
          Clear
        </Button>
      )}
    </section>
  );
}

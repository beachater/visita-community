import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { currentOccupancy, OCCUPANCY_LABEL, type OccupancyLevel, type OccupancyRow } from "@visita/shared-types";
import { cn } from "@visita/ui/utils";
import { supabase } from "@/lib/supabase";

// PRD 4.4 occupancy: one tap, shown on the cafe page and walkthrough, and
// cleared automatically three hours later so it never goes stale.

const LEVELS: { level: OccupancyLevel; hint: string }[] = [
  { level: "quiet", hint: "Plenty of seats" },
  { level: "moderate", hint: "Some seats free" },
  { level: "full", hint: "Hard to find a seat" },
];

const DOT: Record<OccupancyLevel, string> = { quiet: "bg-success", moderate: "bg-gold", full: "bg-destructive" };

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
    <section aria-labelledby="occ-h" className="grid gap-3.5 rounded-card bg-card p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="occ-h" className="font-display text-lg">Right now</h2>
        <p className="text-[0.8rem] text-muted-foreground">
          {current && row
            ? `Showing "${OCCUPANCY_LABEL[current.level]}", set ${current.ago}. It clears at ${clock(row.expires_at)}.`
            : "Nothing showing. Tap one and visitors see it on your page and in the walkthrough for three hours."}
        </p>
      </div>
      {/* The daily tap: three big tiles, one colour dot each. */}
      <div className="grid gap-2.5 sm:grid-cols-3" role="group" aria-label="How busy is it right now?">
        {LEVELS.map(({ level, hint }) => {
          const on = current?.level === level;
          return (
            <button
              key={level}
              type="button"
              aria-pressed={on}
              disabled={busy}
              onClick={() => void set(level)}
              className={cn(
                "flex min-h-16 items-center gap-3 rounded-[1.25rem] px-5 text-left transition-colors disabled:opacity-70",
                on ? "bg-scan text-white" : "bg-muted text-foreground hover:bg-accent",
              )}
            >
              <span className={cn("size-3 shrink-0 rounded-full", DOT[level])} aria-hidden="true" />
              <span className="grid">
                <span className="text-base font-semibold">{OCCUPANCY_LABEL[level]}</span>
                <span className={cn("text-xs", on ? "text-mist" : "text-muted-foreground")}>{hint}</span>
              </span>
            </button>
          );
        })}
      </div>
      {current && (
        <button type="button" className="w-fit rounded-full px-3 py-1.5 text-sm font-semibold text-primary hover:bg-accent disabled:opacity-60" disabled={busy} onClick={() => void set(null)}>
          Clear
        </button>
      )}
    </section>
  );
}

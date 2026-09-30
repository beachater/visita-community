import { useEffect, useState } from "react";
import { currentOccupancy, OCCUPANCY_LABEL, type OccupancyRow } from "@visita/shared-types";
import { cn } from "@visita/ui/utils";
import { watchOccupancy } from "@/lib/live/occupancy";

// "Moderate · 20 min ago", straight from the owner's one tap. Updates live,
// and disappears when it expires even if the page stays open.

const DOT = { quiet: "bg-success", moderate: "bg-warning", full: "bg-destructive" } as const;

export function OccupancyPill({ venueId, tone = "light" }: { venueId: string; tone?: "light" | "glass" }) {
  const [row, setRow] = useState<OccupancyRow | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let stop = () => {};
    let live = true;
    watchOccupancy(venueId, (r) => {
      setRow(r);
      setNow(new Date());
    })
      .then((s) => (live ? (stop = s) : s()))
      .catch(() => undefined);
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => {
      live = false;
      stop();
      window.clearInterval(timer);
    };
  }, [venueId]);

  const current = currentOccupancy(row, now);
  if (!current) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        tone === "glass" ? "border-white/25" : "bg-card",
      )}
      title="Set by the cafe"
    >
      <span className={cn("size-2 rounded-full", DOT[current.level])} aria-hidden="true" />
      {OCCUPANCY_LABEL[current.level]} · {current.ago}
    </span>
  );
}

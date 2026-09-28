import { useState } from "react";
import { Box, Heart, SlidersHorizontal, Star } from "lucide-react";
import { BottomSheet } from "@visita/ui/bottom-sheet";
import { cn } from "@visita/ui/utils";
import type { MapVenue } from "@/lib/discovery/venues";
import { VenueList } from "./VenueList";

// PRD 4.1 dock: 3D Layout (every scanned cafe), Filter, Top Picks (flagged per
// cafe record) and Saved. Lists sort nearest first when location is known.

type Panel = "scanned" | "top" | "saved" | null;

interface Props {
  scanned: (MapVenue & { distance: string | null })[];
  topPicks: (MapVenue & { distance: string | null })[];
  saved: (MapVenue & { distance: string | null })[];
  activeFilters: number;
  onOpenFilters: () => void;
  onPick: (v: MapVenue) => void;
}

export function Dock({ scanned, topPicks, saved, activeFilters, onOpenFilters, onPick }: Props) {
  const [panel, setPanel] = useState<Panel>(null);
  const pick = (v: MapVenue) => {
    setPanel(null);
    onPick(v);
  };

  const pill =
    "pointer-events-auto inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border bg-card px-4 text-sm font-medium shadow-lg hover:bg-accent";

  return (
    <>
      <nav aria-label="Browse cafes" className="flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        <button type="button" className={pill} onClick={() => setPanel("scanned")}>
          <Box className="size-4" aria-hidden="true" /> 3D Layout
        </button>
        <button type="button" className={cn(pill, activeFilters > 0 && "border-primary text-primary")} onClick={onOpenFilters}>
          <SlidersHorizontal className="size-4" aria-hidden="true" /> Filter
          {activeFilters > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-primary text-[0.7rem] text-primary-foreground" aria-label={`${activeFilters} active`}>
              {activeFilters}
            </span>
          )}
        </button>
        <button type="button" className={pill} onClick={() => setPanel("top")}>
          <Star className="size-4" aria-hidden="true" /> Top Picks
        </button>
        <button type="button" className={pill} onClick={() => setPanel("saved")}>
          <Heart className="size-4" aria-hidden="true" /> Saved{saved.length > 0 && ` (${saved.length})`}
        </button>
      </nav>

      <BottomSheet open={panel === "scanned"} onOpenChange={(o) => !o && setPanel(null)} title="Cafes you can step inside" description={`${scanned.length} scanned in 3D`}>
        <VenueList venues={scanned} onPick={pick} empty="No scanned cafes yet." />
      </BottomSheet>
      <BottomSheet open={panel === "top"} onOpenChange={(o) => !o && setPanel(null)} title="Top Picks">
        <VenueList venues={topPicks} onPick={pick} empty="No top picks yet." />
      </BottomSheet>
      <BottomSheet open={panel === "saved"} onOpenChange={(o) => !o && setPanel(null)} title="Saved">
        <VenueList venues={saved} onPick={pick} empty="Tap the heart on a scanned cafe to keep it here." />
      </BottomSheet>
    </>
  );
}

import { BadgeCheck, ChevronRight } from "lucide-react";
import type { MapVenue } from "@/lib/discovery/venues";
import { isOpenAt } from "@/lib/venue/hours";

// A tappable list of venues, used by search results, recently viewed and the
// dock's lists. Scanned cafes carry the 3D badge (PRD 4.1 search).

interface Props {
  venues: (MapVenue & { distance?: string | null })[];
  onPick: (v: MapVenue) => void;
  empty?: string;
}

export function VenueList({ venues, onPick, empty }: Props) {
  if (venues.length === 0) return empty ? <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p> : null;
  const now = new Date();
  return (
    <ul className="divide-y">
      {venues.map((v) => {
        const open = isOpenAt(v.hours, now);
        return (
          <li key={v.slug}>
            <button type="button" onClick={() => onPick(v)} className="flex w-full items-center gap-3 px-1 py-3 text-left hover:bg-accent/60">
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium">{v.name}</span>
                  {v.scanned && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-verified px-1.5 py-px text-[0.65rem] font-bold text-verified-foreground">
                      <BadgeCheck className="size-3" aria-hidden="true" /> 3D
                    </span>
                  )}
                </span>
                <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                  {open !== null && <span className={open ? "text-success" : ""}>{open ? "Open now" : "Closed"}</span>}
                  {v.distance && <span>{v.distance}</span>}
                  {!v.scanned && <span>Not scanned yet</span>}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

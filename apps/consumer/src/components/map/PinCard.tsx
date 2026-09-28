import { useMemo } from "react";
import { BadgeCheck, Check, Eye, Navigation, X } from "lucide-react";
import type { AmenityDefinition } from "@visita/shared-types";
import { Button } from "@visita/ui/button";
import { cn } from "@visita/ui/utils";
import { cardActions, type MapVenue } from "@/lib/discovery/venues";
import { summaryRows } from "@/lib/venue/amenities";
import { isOpenAt } from "@/lib/venue/hours";

// The card that opens when a pin is tapped. Non-modal: the map stays usable
// behind it. Shows only what's known about the venue.

interface Props {
  venue: MapVenue;
  definitions: AmenityDefinition[];
  distance: string | null;
  onClose: () => void;
  onWalkthrough: () => void;
  onDirections: () => void;
  onDemand: () => void;
  /** This device already asked for this cafe to be scanned. */
  demanded: boolean;
  demandPending: boolean;
}

export function PinCard({ venue, definitions, distance, onClose, onWalkthrough, onDirections, onDemand, demanded, demandPending }: Props) {
  const actions = cardActions(venue);
  const strip = useMemo(() => summaryRows(definitions, venue.amenities), [definitions, venue.amenities]);
  const open = isOpenAt(venue.hours, new Date());

  return (
    <section
      aria-label={venue.name}
      className="pointer-events-auto grid gap-3 rounded-2xl border bg-card p-4 text-card-foreground shadow-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1.5">
          <h2 className="font-display text-xl font-semibold leading-tight">{venue.name}</h2>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {venue.scanned ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-verified px-2 py-0.5 font-bold text-verified-foreground">
                <BadgeCheck className="size-3" aria-hidden="true" /> Scanned
              </span>
            ) : (
              <span className="rounded-full border px-2 py-0.5 text-muted-foreground">Not scanned yet</span>
            )}
            {open !== null && (
              <span className={cn("rounded-full border px-2 py-0.5 font-medium", open ? "border-success/40 text-success" : "text-muted-foreground")}>
                {open ? "Open now" : "Closed"}
              </span>
            )}
            {distance && <span className="text-muted-foreground">{distance}</span>}
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" className="-mr-2 -mt-1 shrink-0" aria-label="Close" onClick={onClose}>
          <X className="size-5" />
        </Button>
      </div>

      {venue.address && <p className="text-sm text-muted-foreground">{venue.address}</p>}

      {strip.length > 0 && (
        <dl className="grid grid-cols-3 gap-2 border-t pt-3">
          {strip.map((row) => (
            <div key={row.key} className="min-w-0">
              <dt className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">{row.label}</dt>
              <dd className="truncate text-sm font-medium" title={row.text}>{row.short}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flex flex-wrap gap-2">
        {actions.includes("walkthrough") && (
          <Button className="flex-1" onClick={onWalkthrough}>
            Enter 3D walkthrough
          </Button>
        )}
        {actions.includes("demand") &&
          (demanded ? (
            <Button variant="secondary" className="flex-1" disabled>
              <Check /> Request sent
            </Button>
          ) : (
            <Button className="flex-1" onClick={onDemand} disabled={demandPending}>
              <Eye /> {demandPending ? "Sending…" : "I want to see inside"}
            </Button>
          ))}
        {actions.includes("directions") && (
          <Button variant="outline" onClick={onDirections}>
            <Navigation /> Directions
          </Button>
        )}
      </div>
    </section>
  );
}

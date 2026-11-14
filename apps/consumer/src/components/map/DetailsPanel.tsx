import { Box, Check, Eye } from "lucide-react";
import type { AmenityDefinition } from "@visita/shared-types";
import { Button } from "@visita/ui/button";
import { cn } from "@visita/ui/utils";
import { cardActions, type MapVenue } from "@/lib/discovery/venues";
import { CafeActions, CafeDetails } from "../venue/CafeDetails";

// On a computer, clicking a cafe on the map opens its full details on the
// left (BEA-14 idea 3) instead of the small pin card, so visitors can check
// hours and facts before stepping inside. "Enter 3D walkthrough" stays the
// first button. Phones keep the pin card.

interface Props {
  venue: MapVenue;
  definitions: AmenityDefinition[];
  distance: string | null;
  onClose: () => void;
  onWalkthrough: () => void;
  onDirections: () => void;
  onDemand: () => void;
  onOpenReviews: () => void;
  onOpenMenu: () => void;
  demanded: boolean;
  demandPending: boolean;
  /** Inside the home page's left column: no card chrome, the column scrolls. */
  rail?: boolean;
}

/** The one amber call to action (brand rule): amber fill, navy text. */
export const STEP_INSIDE_CLASS = "bg-verified text-verified-foreground font-bold hover:bg-verified/90";

/** Back here after signing in from "Help keep this accurate". */
export const mapReturnPath = (slug: string) => `${location.pathname}?${new URLSearchParams({ cafe: slug, check: "1" })}`;

export function DetailsPanel({ venue, definitions, distance, onClose, onWalkthrough, onDirections, onDemand, onOpenReviews, onOpenMenu, demanded, demandPending, rail = false }: Props) {
  const actions = cardActions(venue);
  const primary = actions.includes("walkthrough") ? (
    // The room is the reason to be here: a navy preview card carrying the one amber action.
    <div className="relative grid h-44 content-end overflow-hidden rounded-[1.375rem] bg-scan p-3.5">
      <svg viewBox="0 0 400 190" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden="true">
        <path d="M0 190 L120 104 L280 104 L400 190Z" fill="#0B3B6B" /><path d="M120 104 L120 26 L280 26 L280 104Z" fill="#0E4478" />
        <path d="M0 0 L120 26 L120 104 L0 190Z" fill="#093561" /><path d="M400 0 L280 26 L280 104 L400 190Z" fill="#093561" />
      </svg>
      <Button size="lg" className={cn("relative w-full shadow-lg", STEP_INSIDE_CLASS)} onClick={onWalkthrough}><Box /> Step inside in 3D</Button>
    </div>
  ) : demanded ? (
    <Button size="lg" variant="secondary" className="w-full" disabled><Check /> Request sent</Button>
  ) : (
    <Button size="lg" className="w-full" onClick={onDemand} disabled={demandPending}>
      <Eye /> {demandPending ? "Sending…" : "I want to see inside"}
    </Button>
  );

  return (
    <aside
      aria-label={`About ${venue.name}`}
      className={rail ? "text-card-foreground" : "surface-raised pointer-events-auto max-h-full min-h-0 w-[var(--panel-w)] overflow-y-auto overscroll-contain rounded-card text-card-foreground"}
    >
      <CafeDetails
        cafe={venue}
        definitions={definitions}
        tone="light"
        onClose={onClose}
        distance={distance}
        onRequestDistance={null}
        onOpenMenu={onOpenMenu}
        accuracyReturnPath={mapReturnPath(venue.slug)}
        actions={<CafeActions primary={primary} onDirections={actions.includes("directions") ? onDirections : null} onReviews={onOpenReviews} onMenu={venue.menu.length > 0 ? onOpenMenu : null} saveSlug={venue.slug} />}
      />
    </aside>
  );
}

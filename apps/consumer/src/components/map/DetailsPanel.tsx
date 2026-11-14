import { Check, Eye } from "lucide-react";
import type { AmenityDefinition } from "@visita/shared-types";
import { Button } from "@visita/ui/button";
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
}

/** Back here after signing in from "Help keep this accurate". */
export const mapReturnPath = (slug: string) => `${location.pathname}?${new URLSearchParams({ cafe: slug, check: "1" })}`;

export function DetailsPanel({ venue, definitions, distance, onClose, onWalkthrough, onDirections, onDemand, onOpenReviews, onOpenMenu, demanded, demandPending }: Props) {
  const actions = cardActions(venue);
  const primary = actions.includes("walkthrough") ? (
    <Button size="lg" className="w-full" onClick={onWalkthrough}>Enter 3D walkthrough</Button>
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
      className="surface-raised pointer-events-auto max-h-full min-h-0 w-[var(--panel-w)] overflow-y-auto overscroll-contain rounded-card text-card-foreground"
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
        actions={<CafeActions primary={primary} onDirections={actions.includes("directions") ? onDirections : null} onReviews={onOpenReviews} />}
      />
    </aside>
  );
}

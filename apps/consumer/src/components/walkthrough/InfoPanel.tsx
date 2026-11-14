import type { AmenityDefinition } from "@visita/shared-types";
import { accuracyReturnPath } from "@/lib/venue/amenity-report";
import type { WalkthroughCafe } from "@/lib/venue/types";
import { CafeActions, CafeDetails } from "../venue/CafeDetails";

// PRD 4.2 "Cafe info panel", as approved in BEA-14 idea 3: one near-solid
// panel on the left of the walkthrough, a third of the screen wide, with
// everything we know in reading order. It scrolls on its own when the
// screen is short. Unknown fields don't render.

interface Props {
  cafe: WalkthroughCafe;
  definitions: AmenityDefinition[];
  /** "1.2 km away", or null when location isn't known. */
  distance: string | null;
  onRequestDistance: (() => void) | null;
  onDirections: () => void;
  onOpenMenu: () => void;
  onOpenReviews: () => void;
}

export function InfoPanel({ cafe, definitions, distance, onRequestDistance, onDirections, onOpenMenu, onOpenReviews }: Props) {
  return (
    <aside
      aria-label={`About ${cafe.name}`}
      className="panel-dark pointer-events-auto max-h-full w-full overflow-y-auto overscroll-contain rounded-card text-glass-foreground"
    >
      <CafeDetails
        cafe={cafe}
        definitions={definitions}
        tone="dark"
        distance={distance}
        onRequestDistance={onRequestDistance}
        onOpenMenu={onOpenMenu}
        accuracyReturnPath={accuracyReturnPath(cafe.slug, true)}
        actions={<CafeActions onDirections={onDirections} onReviews={onOpenReviews} />}
      />
    </aside>
  );
}

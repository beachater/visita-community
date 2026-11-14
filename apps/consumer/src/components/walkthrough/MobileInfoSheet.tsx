import type { AmenityDefinition } from "@visita/shared-types";
import { BottomSheet } from "@visita/ui/bottom-sheet";
import { accuracyReturnPath } from "@/lib/venue/amenity-report";
import type { WalkthroughCafe } from "@/lib/venue/types";
import { CafeActions, CafeDetails } from "../venue/CafeDetails";

// The phone details sheet. Same order and single "Help keep this accurate"
// button as the desktop panel (BEA-14 idea 3), in one column.

interface Props {
  cafe: WalkthroughCafe;
  definitions: AmenityDefinition[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  distance: string | null;
  onRequestDistance: (() => void) | null;
  onDirections: () => void;
  onOpenMenu: () => void;
  onOpenReviews: () => void;
}

export function MobileInfoSheet({ cafe, definitions, open, onOpenChange, distance, onRequestDistance, onDirections, onOpenMenu, onOpenReviews }: Props) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={cafe.name} description={`About ${cafe.name}`} className="md:hidden [&_[data-slot=sheet-description]]:sr-only">
      {/* The sheet pads its content; the details bring their own edges and dividers. */}
      <div className="-mx-5 -mt-3">
        <CafeDetails
          cafe={cafe}
          definitions={definitions}
          tone="light"
          showName={false}
          distance={distance}
          onRequestDistance={onRequestDistance}
          onOpenMenu={onOpenMenu}
          accuracyReturnPath={accuracyReturnPath(cafe.slug, true)}
          actions={<CafeActions touch onDirections={onDirections} onReviews={() => { onOpenChange(false); onOpenReviews(); }} />}
        />
      </div>
    </BottomSheet>
  );
}

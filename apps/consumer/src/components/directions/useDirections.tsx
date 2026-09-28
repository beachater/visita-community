import { useState, type ReactNode } from "react";
import { Button } from "@visita/ui/button";
import { BottomSheet } from "@visita/ui/bottom-sheet";
import { appleMapsUrl, googleMapsUrl, prefersAppleMapsChoice } from "@/lib/venue/directions";

// "Get directions" hands off to a maps app (decided 2026-09-28). Apple devices
// get a Google Maps / Apple Maps choice, since many only have Apple Maps.
// Returns the action to call and the sheet to render.

export interface DirectionsTarget {
  name: string;
  address: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
  googlePlaceId: string | null;
}

export function useDirections(): { open: (target: DirectionsTarget) => void; isOpen: boolean; sheet: ReactNode } {
  const [target, setTarget] = useState<DirectionsTarget | null>(null);

  const open = (t: DirectionsTarget) => {
    if (prefersAppleMapsChoice()) setTarget(t);
    else window.open(googleMapsUrl(t), "_blank", "noopener");
  };

  const sheet = (
    <BottomSheet
      open={target !== null}
      onOpenChange={(o) => !o && setTarget(null)}
      title="Get directions"
      description={target ? `Open ${target.name} in a maps app.` : undefined}
    >
      {target && (
        <div className="grid gap-2">
          <Button asChild size="lg" onClick={() => setTarget(null)}>
            <a href={googleMapsUrl(target)} target="_blank" rel="noopener">Google Maps</a>
          </Button>
          <Button asChild size="lg" variant="outline" onClick={() => setTarget(null)}>
            <a href={appleMapsUrl(target)} target="_blank" rel="noopener">Apple Maps</a>
          </Button>
        </div>
      )}
    </BottomSheet>
  );

  return { open, isOpen: target !== null, sheet };
}

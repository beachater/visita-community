import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@visita/ui/button";
import { BottomSheet } from "@visita/ui/bottom-sheet";
import { appleMapsUrl, googleMapsUrl, prefersAppleMapsChoice } from "@/lib/venue/directions";
import { loadPlatformSettings } from "@/lib/settings/platform";
import { InAppDirections } from "./InAppDirections";

// "Get directions" hands off to a maps app (decided 2026-09-28). Apple devices
// get a Google Maps / Apple Maps choice, since many only have Apple Maps.
// When an admin turns on "In-app Google Maps directions" (platform_settings),
// directions show inside Visita instead (InAppDirections). With it off, or
// until the setting has loaded, nothing changes.
// Returns the action to call and the sheet to render.

export interface DirectionsTarget {
  name: string;
  address: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
  googlePlaceId: string | null;
}

function useInAppDirections(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    void loadPlatformSettings().then((s) => live && setOn(s.inAppDirections));
    return () => {
      live = false;
    };
  }, []);
  return on;
}

export function useDirections(): { open: (target: DirectionsTarget) => void; isOpen: boolean; sheet: ReactNode } {
  const inApp = useInAppDirections();
  const [target, setTarget] = useState<DirectionsTarget | null>(null);
  const [inAppTarget, setInAppTarget] = useState<DirectionsTarget | null>(null);

  const open = (t: DirectionsTarget) => {
    if (inApp) setInAppTarget(t);
    else if (prefersAppleMapsChoice()) setTarget(t);
    else window.open(googleMapsUrl(t), "_blank", "noopener");
  };

  const sheet = (
    <>
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
      {inApp && <InAppDirections target={inAppTarget} onClose={() => setInAppTarget(null)} />}
    </>
  );

  return { open, isOpen: target !== null || inAppTarget !== null, sheet };
}

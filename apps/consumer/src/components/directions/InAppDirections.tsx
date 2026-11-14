import { useEffect, useState } from "react";
import { ExternalLink, MapPin, Route } from "lucide-react";
import { Button } from "@visita/ui/button";
import { BottomSheet } from "@visita/ui/bottom-sheet";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@visita/ui/sheet";
import { appleMapsUrl, googleMapsUrl, prefersAppleMapsChoice } from "@/lib/venue/directions";
import type { DirectionsTarget } from "./useDirections";

// Directions inside Visita, shown when the admin "In-app Google Maps
// directions" setting is on. A bottom sheet on phones, a side panel on wider
// screens. It always keeps "Open in Google Maps": the route here is for a
// look, while real turn-by-turn navigation still needs the maps app.
//
// The route itself goes in RoutePreview. Which Google product draws it (Maps
// Embed API or Maps JavaScript API + Routes) is still to be decided, so for
// now that slot shows the destination only.

const DESKTOP = "(min-width: 768px)";

function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(() => typeof window !== "undefined" && window.matchMedia(DESKTOP).matches);
  useEffect(() => {
    const media = window.matchMedia(DESKTOP);
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return desktop;
}

// The address already ends with the city when there is one (as on the pin card).
const placeLine = (t: DirectionsTarget) => t.address ?? t.city;

function RoutePreview({ target }: { target: DirectionsTarget }) {
  return (
    <div className="grid aspect-[4/3] w-full place-items-center rounded-card bg-muted p-6 text-center" data-testid="route-preview">
      <div className="grid justify-items-center gap-2">
        <Route className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium">The route to {target.name} will show here.</p>
        <p className="text-sm text-muted-foreground">For now, open Google Maps for the route and turn-by-turn navigation.</p>
      </div>
    </div>
  );
}

function Body({ target }: { target: DirectionsTarget }) {
  const place = placeLine(target);
  return (
    <div className="grid gap-4">
      <RoutePreview target={target} />
      {place && (
        <p className="flex items-start gap-2 text-sm">
          <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>{place}</span>
        </p>
      )}
    </div>
  );
}

function Actions({ target, onDone }: { target: DirectionsTarget; onDone: () => void }) {
  return (
    <div className="grid gap-2">
      <Button asChild size="lg" onClick={onDone}>
        <a href={googleMapsUrl(target)} target="_blank" rel="noopener">
          <ExternalLink aria-hidden="true" /> Open in Google Maps
        </a>
      </Button>
      {prefersAppleMapsChoice() && (
        <Button asChild size="lg" variant="outline" onClick={onDone}>
          <a href={appleMapsUrl(target)} target="_blank" rel="noopener">
            Open in Apple Maps
          </a>
        </Button>
      )}
    </div>
  );
}

export function InAppDirections({ target, onClose }: { target: DirectionsTarget | null; onClose: () => void }) {
  const desktop = useIsDesktop();
  const open = target !== null;
  const title = target ? `Directions to ${target.name}` : "Directions";
  const onOpenChange = (o: boolean) => !o && onClose();

  if (!desktop) {
    // A short title: the sheet header has no room beside the close button.
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange} title="Directions" description={target ? `To ${target.name}` : undefined} footer={target && <Actions target={target} onDone={onClose} />}>
        {target && <Body target={target} />}
      </BottomSheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 border-0 bg-card p-0 sm:max-w-md">
        <SheetHeader className="px-6 pt-6 pb-3 pr-14 text-left">
          <SheetTitle className="font-display text-xl">{title}</SheetTitle>
          <SheetDescription className="sr-only">The route to this cafe, and a button to open Google Maps.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-6">{target && <Body target={target} />}</div>
        {target && (
          <div className="border-t px-6 py-4">
            <Actions target={target} onDone={onClose} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

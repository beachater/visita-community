import { useEffect, useState } from "react";
import { ExternalLink, LocateFixed, MapPin } from "lucide-react";
import { Button } from "@visita/ui/button";
import { BottomSheet } from "@visita/ui/bottom-sheet";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@visita/ui/sheet";
import { appleMapsUrl, googleEmbedKey, googleEmbedUrl, googleMapsUrl, prefersAppleMapsChoice } from "@/lib/venue/directions";
import type { DirectionsTarget } from "./useDirections";

// Directions inside Visita, shown when the admin "In-app Google Maps
// directions" setting is on. A bottom sheet on phones, a side panel on wider
// screens. It always keeps "Open in Google Maps": the route here is for a
// look, while real turn-by-turn navigation still needs the maps app.
//
// The map is a Google Maps Embed API iframe (board decision 2026-11-14).
// Directions mode needs a starting point, so it opens on the cafe and draws
// the route once the visitor shares their location. The Embed API has no
// marker or style options, so the pins in it are Google's; our amber pin and
// the cafe name sit in the header instead.

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

type Locate = { state: "idle" | "locating" | "denied" } | { state: "located"; origin: { lat: number; lng: number } };

function RoutePreview({ target }: { target: DirectionsTarget }) {
  const key = googleEmbedKey();
  const [locate, setLocate] = useState<Locate>({ state: "idle" });
  if (!key) return null; // useDirections never opens this without a key.

  const findMe = () => {
    if (!("geolocation" in navigator)) return setLocate({ state: "denied" });
    setLocate({ state: "locating" });
    navigator.geolocation.getCurrentPosition(
      (p) => setLocate({ state: "located", origin: { lat: p.coords.latitude, lng: p.coords.longitude } }),
      () => setLocate({ state: "denied" }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  };
  const origin = locate.state === "located" ? locate.origin : undefined;

  return (
    <div className="grid gap-2">
      <iframe
        key={origin ? "route" : "place"}
        title={origin ? `Route to ${target.name}` : `${target.name} on Google Maps`}
        src={googleEmbedUrl(target, key, origin)}
        className="aspect-[4/3] w-full rounded-card border-0 bg-muted"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
        data-testid="route-preview"
      />
      {locate.state !== "located" && (
        <Button variant="outline" onClick={findMe} disabled={locate.state === "locating"}>
          <LocateFixed aria-hidden="true" /> {locate.state === "locating" ? "Finding you…" : "Show the route from my location"}
        </Button>
      )}
      {locate.state === "denied" && (
        <p className="text-sm text-muted-foreground" role="status">
          We couldn't get your location. Open Google Maps below for the route.
        </p>
      )}
    </div>
  );
}

const pinShape = "M14 35s11-11.2 11-20.5C25 7.6 20.1 3 14 3S3 7.6 3 14.5C3 23.8 14 35 14 35z";

/** Our amber pin beside the cafe name, so the brand stays in view above Google's map. */
function Destination({ name }: { name: string }) {
  return (
    <span className="flex items-center gap-2">
      <svg width="18" height="23" viewBox="0 0 28 36" aria-hidden="true" className="shrink-0">
        <path d={pinShape} fill="var(--verified)" stroke="var(--brand-navy)" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="14" cy="14.5" r="4" fill="var(--brand-navy)" />
      </svg>
      <span>
        <span className="sr-only">Directions to </span>
        {name}
      </span>
    </span>
  );
}

function Body({ target, showName }: { target: DirectionsTarget; showName?: boolean }) {
  const place = placeLine(target);
  return (
    <div className="grid gap-4">
      {showName && (
        <p className="font-display text-lg">
          <Destination name={target.name} />
        </p>
      )}
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
  const onOpenChange = (o: boolean) => !o && onClose();

  if (!desktop) {
    // A short title: the sheet header has no room beside the close button, so
    // the pin and cafe name open the body instead.
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange} title="Directions" footer={target && <Actions target={target} onDone={onClose} />}>
        {target && <Body target={target} showName />}
      </BottomSheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 border-0 bg-card p-0 sm:max-w-md">
        <SheetHeader className="px-6 pt-6 pb-3 pr-14 text-left">
          <SheetTitle className="font-display text-xl">{target ? <Destination name={target.name} /> : "Directions"}</SheetTitle>
          <SheetDescription className="sr-only">Directions to this cafe on Google Maps, and a button to open the Google Maps app.</SheetDescription>
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

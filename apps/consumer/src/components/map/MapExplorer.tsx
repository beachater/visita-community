import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Map, MapControls, MapMarker, MarkerContent, type MapRef } from "@visita/ui/map";
import { Toaster } from "@visita/ui/sonner";
import { cn } from "@visita/ui/utils";
import { fetchVenues, type VenuesPayload } from "@/lib/discovery/api";
import { CDO_BOUNDS, CDO_CENTER, mapStyle } from "@/lib/discovery/map-style";
import { pinnable, toWalkthrough, type MapVenue } from "@/lib/discovery/venues";
import { getDeviceProfile } from "@/lib/splat/device";
import { splatSrc } from "@/lib/splat/source";
import { useDirections } from "../directions/useDirections";
import { WalkthroughScreen } from "../walkthrough/WalkthroughScreen";
import { PinCard } from "./PinCard";
import { VenuePin } from "./VenuePin";
import { BASEMAP_KEY, setupMapLibre } from "./setup";

setupMapLibre();

// PRD 4.1 discovery: the Cagayan de Oro map with a pin for every cafe. Tapping
// a pin opens its card; "Enter 3D walkthrough" opens the walkthrough over the
// map and puts /cafe/<slug> in the address bar, so the link is shareable and
// Back returns to the map exactly as it was.

interface Props {
  /** "full": /explore, the whole screen. "hero": the top of the home page. */
  mode: "full" | "hero";
}

export function MapExplorer({ mode }: Props) {
  const [data, setData] = useState<VenuesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [walkthrough, setWalkthrough] = useState<string | null>(null);
  const mapRef = useRef<MapRef>(null);
  const pushed = useRef(false);
  const profile = useMemo(getDeviceProfile, []);
  const directions = useDirections();

  useEffect(() => {
    const ctrl = new AbortController();
    fetchVenues(ctrl.signal)
      .then(setData)
      .catch((e: unknown) => {
        if ((e as DOMException)?.name !== "AbortError") setError("Couldn't load cafes. Check your connection and reload.");
      });
    return () => ctrl.abort();
  }, []);

  // PMTiles needs an absolute URL; the basemap is served from our own domain.
  const style = useMemo(() => mapStyle(new URL(splatSrc(BASEMAP_KEY), location.href).href), []);
  const venues = data?.venues ?? [];
  const selectedVenue = venues.find((v) => v.slug === selected) ?? null;
  const walkthroughCafe = useMemo(() => {
    const v = venues.find((x) => x.slug === walkthrough);
    return v ? toWalkthrough(v) : null;
  }, [venues, walkthrough]);

  const select = useCallback((v: MapVenue) => {
    setSelected(v.slug);
    if (pinnable(v)) mapRef.current?.easeTo({ center: [v.lng, v.lat], duration: 400 });
  }, []);

  // Tapping empty map closes the card. Pins are DOM markers above the canvas,
  // so tapping one doesn't reach this handler.
  const attachMap = useCallback((map: MapRef | null) => {
    mapRef.current = map;
    map?.on("click", () => setSelected(null));
    // ?debug exposes the map and its errors in the console for troubleshooting.
    if (map && new URLSearchParams(location.search).has("debug")) {
      (window as unknown as { visitaMap?: MapRef }).visitaMap = map;
      map.on("error", (e) => console.error("[visita-map]", e.error?.message ?? e));
    }
  }, []);

  // The walkthrough is a history entry at /cafe/<slug>; Back closes it.
  const openWalkthrough = (v: MapVenue) => {
    if (!profile.webgl2) {
      location.href = `/cafe/${v.slug}`; // The cafe page explains what's missing.
      return;
    }
    history.pushState({ walkthrough: v.slug }, "", `/cafe/${v.slug}`);
    pushed.current = true;
    setWalkthrough(v.slug);
  };
  useEffect(() => {
    const onPop = () => {
      if (pushed.current) {
        pushed.current = false;
        setWalkthrough(null);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const closeWalkthrough = () => {
    if (pushed.current) history.back();
    else setWalkthrough(null);
  };

  useEffect(() => {
    if (!walkthrough) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [walkthrough]);

  return (
    <div className={cn("relative overflow-hidden bg-muted", mode === "full" ? "h-dvh w-full" : "h-[70dvh] min-h-[28rem] w-full")}>
      <Toaster position="top-center" />
      <Map
        ref={attachMap}
        theme="light"
        styles={{ light: style, dark: style }}
        center={CDO_CENTER}
        zoom={13}
        minZoom={11}
        maxZoom={18}
        pitch={30}
        maxBounds={CDO_BOUNDS}
        loading={!data && !error}
      >
        <MapControls position="bottom-right" showZoom showLocate className="mb-[var(--consent-h,0px)]" />
        {venues.filter(pinnable).map((v) => (
          <MapMarker key={v.slug} longitude={v.lng} latitude={v.lat} anchor="bottom">
            <MarkerContent>
              <VenuePin name={v.name} scanned={v.scanned} selected={v.slug === selected} onSelect={() => select(v)} />
            </MarkerContent>
          </MapMarker>
        ))}
      </Map>

      {error && (
        <p role="alert" className="absolute inset-x-3 top-3 rounded-lg border bg-card px-4 py-3 text-sm shadow">
          {error}
        </p>
      )}

      {selectedVenue && data && (
        <div
          className="pointer-events-none absolute inset-x-3 flex justify-center sm:justify-start"
          style={{ bottom: "calc(0.75rem + var(--consent-h, 0px))", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="w-full max-w-md">
            <PinCard
              venue={selectedVenue}
              definitions={data.definitions}
              distance={null}
              onClose={() => setSelected(null)}
              onWalkthrough={() => openWalkthrough(selectedVenue)}
              onDirections={() => directions.open(selectedVenue)}
            />
          </div>
        </div>
      )}

      {directions.sheet}

      {walkthroughCafe && data && (
        <WalkthroughScreen cafe={walkthroughCafe} definitions={data.definitions} profile={profile} onClose={closeWalkthrough} />
      )}
    </div>
  );
}

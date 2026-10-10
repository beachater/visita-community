import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@nanostores/react";
import { toast } from "sonner";
import { Map, MapControls, MapMarker, MarkerContent, type MapRef } from "@visita/ui/map";
import { Toaster } from "@visita/ui/sonner";
import { cn } from "@visita/ui/utils";
import { fetchVenues, type VenuesPayload } from "@/lib/discovery/api";
import { requestScan } from "@/lib/discovery/demand-client";
import { activeFilterCount, activeFilterNames, applyFilters, EMPTY_FILTERS, type Filters } from "@/lib/discovery/filters";
import { track } from "@/lib/analytics/track";
import { sortVenues, withDistance } from "@/lib/discovery/sort";
import type { Coords } from "@/lib/venue/distance";
import { $demanded, $saved } from "@/lib/visitor/stores";
import { CDO_BOUNDS, CDO_CENTER, mapStyle } from "@/lib/discovery/map-style";
import { pinnable, toWalkthrough, type MapVenue } from "@/lib/discovery/venues";
import { getDeviceProfile } from "@/lib/splat/device";
import { splatSrc } from "@/lib/splat/source";
import { useDirections } from "../directions/useDirections";
import { WalkthroughScreen } from "../walkthrough/WalkthroughScreen";
import { Dock } from "./Dock";
import { FilterSheet } from "./FilterSheet";
import { PinCard } from "./PinCard";
import { SearchBar } from "./SearchBar";
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
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showUnknown, setShowUnknown] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [here, setHere] = useState<Coords | null>(null);
  const [demandPending, setDemandPending] = useState(false);
  const savedSlugs = useStore($saved);
  const demandedSlugs = useStore($demanded);

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
  const filterResult = useMemo(() => applyFilters(venues, filters, showUnknown), [venues, filters, showUnknown]);
  const pins = filterResult.shown.filter(pinnable);
  const lists = useMemo(() => {
    const ranked = withDistance(sortVenues(venues, here), here);
    return {
      scanned: ranked.filter((v) => v.scanned),
      topPicks: ranked.filter((v) => v.isTopPick),
      saved: savedSlugs.map((slug) => ranked.find((v) => v.slug === slug)).filter((v): v is (typeof ranked)[number] => Boolean(v)),
    };
  }, [venues, here, savedSlugs]);
  const selectedVenue = venues.find((v) => v.slug === selected) ?? null;
  const selectedDistance = selectedVenue ? (withDistance([selectedVenue], here)[0]?.distance ?? null) : null;

  const onDemand = async (slug: string) => {
    setDemandPending(true);
    const outcome = await requestScan(slug);
    setDemandPending(false);
    if (outcome.ok) toast.success("Thanks. We'll ask this cafe about a scan.");
    else toast(outcome.message);
  };
  const walkthroughCafe = useMemo(() => {
    const v = venues.find((x) => x.slug === walkthrough);
    return v ? toWalkthrough(v) : null;
  }, [venues, walkthrough]);

  // Which filters were on when a venue was opened (PRD 4.4 "which filters brought people in").
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const withFilters = () => {
    const names = activeFilterNames(filtersRef.current);
    return names.length ? { filters: names } : {};
  };

  const select = useCallback((v: MapVenue) => {
    setSelected(v.slug);
    track("profile_view", v.id, withFilters());
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
    track("walkthrough_open", v.id, withFilters());
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
    <div className="relative h-dvh w-full overflow-hidden bg-muted">
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
        <MapControls
          position="top-right"
          showZoom
          showLocate
          className={mode === "hero" ? "mt-36" : "mt-16"}
          onLocate={({ latitude, longitude }) => setHere({ lat: latitude, lng: longitude })}
        />
        {pins.map((v) => (
          <MapMarker key={v.slug} longitude={v.lng} latitude={v.lat} anchor="bottom">
            <MarkerContent>
              <VenuePin name={v.name} scanned={v.scanned} selected={v.slug === selected} onSelect={() => select(v)} />
            </MarkerContent>
          </MapMarker>
        ))}
      </Map>

      {error && (
        <p role="alert" className="surface-raised absolute inset-x-3 top-3 rounded-card px-5 py-3 text-sm">
          {error}
        </p>
      )}

      {/* Search sits at the top; in full-screen mode it leaves room for the Visita chip. */}
      <div
        className={cn("pointer-events-none absolute right-3 z-10", mode === "full" ? "left-[6.75rem] sm:left-auto sm:w-[26rem]" : "left-3 sm:left-auto sm:w-[26rem]")}
        style={{ top: mode === "hero" ? "calc(max(0.75rem, env(safe-area-inset-top)) + 4.5rem)" : "max(0.75rem, env(safe-area-inset-top))" }}
      >
        {data && <SearchBar venues={venues} onPick={select} />}
      </div>

      {/* Bottom: the pin card above the dock, both clear of the consent notice. */}
      <div
        className="pointer-events-none absolute inset-x-3 grid gap-2"
        style={{ bottom: "calc(0.75rem + var(--consent-h, 0px))", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {selectedVenue && data && (
          <div className="flex justify-center sm:justify-start">
            <div className="w-full max-w-md">
              <PinCard
                venue={selectedVenue}
                definitions={data.definitions}
                distance={selectedDistance}
                onClose={() => setSelected(null)}
                onWalkthrough={() => openWalkthrough(selectedVenue)}
                onDirections={() => {
                  track("directions_tap", selectedVenue.id);
                  directions.open(selectedVenue);
                }}
                onDemand={() => {
                  track("demand_tap", selectedVenue.id);
                  void onDemand(selectedVenue.slug);
                }}
                demanded={demandedSlugs.includes(selectedVenue.slug)}
                demandPending={demandPending}
              />
            </div>
          </div>
        )}
        {data && (
          <Dock
            scanned={lists.scanned}
            topPicks={lists.topPicks}
            saved={lists.saved}
            activeFilters={activeFilterCount(filters)}
            onOpenFilters={() => setFiltersOpen(true)}
            onPick={select}
          />
        )}
      </div>

      <FilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        onChange={(f) => {
          setFilters(f);
          if (activeFilterCount(f) === 0) setShowUnknown(false);
        }}
        result={filterResult}
        showUnknown={showUnknown}
        onShowUnknown={setShowUnknown}
      />

      {directions.sheet}

      {walkthroughCafe && data && (
        <WalkthroughScreen cafe={walkthroughCafe} definitions={data.definitions} profile={profile} onClose={closeWalkthrough} />
      )}
    </div>
  );
}

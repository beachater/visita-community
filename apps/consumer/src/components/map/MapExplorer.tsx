import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useStore } from "@nanostores/react";
import { toast } from "sonner";
import { Map, MapControls, MapMarker, MarkerContent, type MapRef } from "@visita/ui/map";
import { Toaster } from "@visita/ui/sonner";
import { cn } from "@visita/ui/utils";
import { fetchVenues, type VenuesPayload } from "@/lib/discovery/api";
import { requestScan } from "@/lib/discovery/demand-client";
import { activeFilterCount, activeFilterNames, applyFilters, EMPTY_FILTERS, filterOptions, type Filters } from "@/lib/discovery/filters";
import { track } from "@/lib/analytics/track";
import { sortVenues, withDistance } from "@/lib/discovery/sort";
import type { Coords } from "@/lib/venue/distance";
import { $demanded, $saved } from "@/lib/visitor/stores";
import { CDO_BOUNDS, CDO_CENTER, mapStyle } from "@/lib/discovery/map-style";
import { pinnable, toWalkthrough, type MapVenue } from "@/lib/discovery/venues";
import { getDeviceProfile } from "@/lib/splat/device";
import { splatSrc } from "@/lib/splat/source";
import { isOpenAt } from "@/lib/venue/hours";
import { useDirections } from "../directions/useDirections";
import { WalkthroughReviews } from "../reviews/WalkthroughReviews";
import { MenuSheet } from "../venue/MenuSheet";
import { WalkthroughScreen } from "../walkthrough/WalkthroughScreen";
import { DetailsPanel } from "./DetailsPanel";
import { Dock } from "./Dock";
import { Box, SlidersHorizontal } from "lucide-react";
import { FilterPanel, FilterSheet } from "./FilterSheet";
import { HomeRail } from "./HomeRail";
import { PinCard } from "./PinCard";
import { SearchBar } from "./SearchBar";
import { VenuePin } from "./VenuePin";
import { BASEMAP_KEY, setupMapLibre } from "./setup";

setupMapLibre();

// PRD 4.1 discovery: the Cagayan de Oro map with a pin for every cafe. Tapping
// a pin opens its card (on a computer, the full details panel on the left);
// "Enter 3D walkthrough" opens the walkthrough over the map and puts
// /cafe/<slug> in the address bar, so the link is shareable and Back returns
// to the map exactly as it was.

interface Props {
  /** "full": /explore, the whole screen. "hero": the top of the home page. */
  mode: "full" | "hero";
  /** The list card's heading and line under it, when not the home page. */
  title?: string;
  lede?: string;
}

export function MapExplorer({ mode, title, lede }: Props) {
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
  const [openNow, setOpenNow] = useState(false);
  const [threeDOnly, setThreeDOnly] = useState(false);
  const [cardHeight, setCardHeight] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const [here, setHere] = useState<Coords | null>(null);
  const [demandPending, setDemandPending] = useState(false);
  const savedSlugs = useStore($saved);
  const desktop = useDesktop();
  // Home on a computer: list column on the left, map on the right.
  const railMode = mode === "hero" && desktop;
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
  // Filters come from amenity definitions marked filterable (plus price and 24/7).
  const options = useMemo(() => filterOptions(data?.definitions ?? []), [data]);
  const filterResult = useMemo(() => applyFilters(venues, filters, showUnknown), [venues, filters, showUnknown]);
  const visibleResult = useMemo(() => ({
    ...filterResult,
    shown: filterResult.shown.filter((v) =>
      (!threeDOnly || v.scanned) && (!openNow || isOpenAt(v.hours, new Date()) === true)),
  }), [filterResult, openNow, threeDOnly]);
  const pins = visibleResult.shown.filter(pinnable);
  const lists = useMemo(() => {
    const visible = openNow ? venues.filter((v) => isOpenAt(v.hours, new Date()) === true) : venues;
    const ranked = withDistance(sortVenues(visible, here), here);
    return {
      scanned: ranked.filter((v) => v.scanned),
      topPicks: ranked.filter((v) => v.isTopPick),
      saved: savedSlugs.map((slug) => ranked.find((v) => v.slug === slug)).filter((v): v is (typeof ranked)[number] => Boolean(v)),
    };
  }, [venues, here, savedSlugs, openNow]);
  const matches = useMemo(() => withDistance(sortVenues(visibleResult.shown, here), here), [visibleResult.shown, here]);
  const selectedVenue = venues.find((v) => v.slug === selected) ?? null;
  const selectedDistance = selectedVenue ? (withDistance([selectedVenue], here)[0]?.distance ?? null) : null;
  useEffect(() => {
    if (mode !== "hero" || !selectedVenue || !cardRef.current) return;
    const card = cardRef.current;
    const measure = () => setCardHeight(card.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    return () => observer.disconnect();
  }, [mode, selectedVenue?.slug]);

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

  // ?cafe=<slug> opens that cafe, e.g. back from signing in on its panel.
  useEffect(() => {
    if (!data) return;
    const wanted = new URLSearchParams(location.search).get("cafe");
    const venue = wanted ? data.venues.find((v) => v.slug === wanted) : undefined;
    if (venue) select(venue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  const toggleOpenNow = () => { setOpenNow((value) => !value); setSelected(null); };
  const toggleThreeD = () => { setThreeDOnly((value) => !value); setSelected(null); };
  const browseDock = data && !railMode && (
    <Dock
      scanned={lists.scanned}
      topPicks={lists.topPicks}
      saved={lists.saved}
      matches={matches}
      filters={filters}
      filterOptions={options}
      onChangeFilters={(f) => { setFilters(f); if (activeFilterCount(f) === 0) setShowUnknown(false); }}
      showUnknown={showUnknown}
      onShowUnknown={setShowUnknown}
      hiddenForMissingData={filterResult.hiddenForMissingData}
      activeFilters={activeFilterCount(filters)}
      onOpenFilters={() => setFiltersOpen(true)}
      onPick={select}
      home={mode === "hero"}
      openNow={openNow}
      onToggleOpenNow={toggleOpenNow}
      threeDOnly={threeDOnly}
      onToggleThreeD={toggleThreeD}
      selected={Boolean(selectedVenue)}
    />
  );

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

  const detailsPanel = selectedVenue && data && desktop && (
    <DetailsPanel
      key={selectedVenue.slug}
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
      onOpenReviews={() => setReviewsOpen(true)}
      onOpenMenu={() => setMenuOpen(true)}
      demanded={demandedSlugs.includes(selectedVenue.slug)}
      demandPending={demandPending}
      rail={railMode}
    />
  );

  const quickChip = "surface-raised pointer-events-auto inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium";
  const quickChipOn = "bg-foreground! text-white";

  return (
    <div
      className={cn(
        "relative h-dvh w-full overflow-hidden bg-muted md:[--panel-w:22.5rem] lg:[--panel-w:25rem] xl:[--panel-w:27.5rem] min-[90rem]:[--panel-w:30rem]",
        mode === "hero" && "map-home",
        mode === "hero" && selectedVenue && "map-home-selected",
      )}
      style={{ "--map-card-h": `${cardHeight}px` } as CSSProperties}
    >
      {railMode && data && (
        <HomeRail
          search={(wide) => <SearchBar venues={venues} onPick={select} rail wide={wide} />}
          details={detailsPanel}
          onBack={() => setSelected(null)}
          matches={matches}
          total={venues.length}
          selected={selected}
          onPick={select}
          threeDOnly={threeDOnly}
          onToggleThreeD={toggleThreeD}
          openNow={openNow}
          onToggleOpenNow={toggleOpenNow}
          activeFilters={activeFilterCount(filters)}
          onOpenFilters={() => setFiltersOpen((o) => !o)}
          filtersOpen={filtersOpen}
          title={title}
          lede={lede}
        />
      )}
      <div className="relative h-full min-w-0 overflow-hidden">
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
          position={mode === "hero" ? "bottom-right" : "top-right"}
          showZoom
          showLocate
          className={mode === "hero" ? cn("map-home-controls", selectedVenue && "map-home-controls-selected") : "mt-16"}
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
        <p role="alert" className={cn("surface-raised absolute inset-x-3 z-20 rounded-card px-5 py-3 text-sm", mode === "hero" ? "top-40 sm:top-24" : "top-3")}>
          {error}
        </p>
      )}


      {/* Phone home groups search, quick filters and browse; /explore keeps its compact search. */}
      {!railMode && <div
        className={cn("pointer-events-none absolute z-20", mode === "hero" ? "map-home-search" : "left-[6.75rem] right-3 sm:left-auto sm:w-[26rem]")}
        style={mode === "full" ? { top: "max(0.75rem, env(safe-area-inset-top))" } : undefined}
      >
        {data && <SearchBar venues={venues} onPick={select} home={mode === "hero"} />}
        {mode === "hero" && data && (
          <div className="mt-2.5 flex gap-2" aria-label="Quick cafe filters">
            <button type="button" className={cn(quickChip, threeDOnly && quickChipOn)} aria-pressed={threeDOnly} onClick={toggleThreeD}>
              <Box className="size-4" aria-hidden="true" /> 3D only
            </button>
            <button type="button" className={cn(quickChip, openNow && quickChipOn)} aria-pressed={openNow} onClick={toggleOpenNow}>Open now</button>
            <button type="button" className={quickChip} onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal className="size-4" aria-hidden="true" /> Filters{activeFilterCount(filters) > 0 && ` (${activeFilterCount(filters)})`}
            </button>
          </div>
        )}
        {mode === "hero" && <div className="relative z-10">{browseDock}</div>}
      </div>}

      {/* /explore keeps search on the right, so the panel has the left to itself. */}
      {mode === "full" && detailsPanel && (
        <div className="pointer-events-none absolute left-3 z-20 flex flex-col" style={{ top: "calc(max(0.75rem, env(safe-area-inset-top)) + 3.75rem)", bottom: "calc(0.75rem + var(--consent-h, 0px))" }}>
          {detailsPanel}
        </div>
      )}

      {/* The selected venue stays above the consent notice. Home puts browse controls by search. */}
      <div
        ref={cardRef}
        className={cn("pointer-events-none absolute z-10 grid gap-2", mode === "hero" ? "map-home-card" : "inset-x-3")}
        style={{ bottom: "calc(0.75rem + var(--consent-h, 0px))", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {selectedVenue && data && !desktop && (
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
        {mode === "full" && browseDock}
      </div>
      </div>

      {railMode ? (
        filtersOpen && (
          <FilterPanel
            onClose={() => setFiltersOpen(false)}
            options={options}
            filters={filters}
            onChange={(f) => {
              setFilters(f);
              if (activeFilterCount(f) === 0) setShowUnknown(false);
            }}
            result={visibleResult}
            showUnknown={showUnknown}
            onShowUnknown={setShowUnknown}
          />
        )
      ) : (
        <FilterSheet
          options={options}
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          filters={filters}
          onChange={(f) => {
            setFilters(f);
            if (activeFilterCount(f) === 0) setShowUnknown(false);
          }}
          result={visibleResult}
          showUnknown={showUnknown}
          onShowUnknown={setShowUnknown}
        />
      )}

      {directions.sheet}

      {selectedVenue && (
        <>
          <WalkthroughReviews slug={selectedVenue.slug} cafeName={selectedVenue.name} open={reviewsOpen} onOpenChange={setReviewsOpen} />
          <MenuSheet cafeName={selectedVenue.name} menu={selectedVenue.menu} open={menuOpen} onOpenChange={setMenuOpen} />
        </>
      )}

      {walkthroughCafe && data && (
        <WalkthroughScreen cafe={walkthroughCafe} definitions={data.definitions} profile={profile} onClose={closeWalkthrough} />
      )}
    </div>
  );
}

/** Computers get the details panel; phones keep the pin card. */
function useDesktop(): boolean {
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 768px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return desktop;
}

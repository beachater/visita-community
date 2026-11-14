import { useEffect, useRef, useState } from "react";
import { Box, ChevronUp, Compass, Heart, SlidersHorizontal, Star } from "lucide-react";
import { BottomSheet } from "@visita/ui/bottom-sheet";
import { Label } from "@visita/ui/label";
import { Switch } from "@visita/ui/switch";
import { cn } from "@visita/ui/utils";
import type { MapVenue } from "@/lib/discovery/venues";
import { EMPTY_FILTERS, type FilterOption, type Filters } from "@/lib/discovery/filters";
import { FilterControls } from "./FilterControls";
import { isOpenAt } from "@/lib/venue/hours";
import { ConsentInline } from "../site/ConsentInline";
import { getConsent } from "@/lib/consent";
import { VenueList } from "./VenueList";

// PRD 4.1 dock: 3D Layout (every scanned cafe), Filter, Top Picks (flagged per
// cafe record) and Saved. Lists sort nearest first when location is known.

const FOLD_KEY = "visita:peek-folded";

type Panel = "scanned" | "top" | "saved" | "browse" | null;

interface Props {
  scanned: (MapVenue & { distance: string | null })[];
  topPicks: (MapVenue & { distance: string | null })[];
  saved: (MapVenue & { distance: string | null })[];
  matches: (MapVenue & { distance: string | null })[];
  filters: Filters;
  filterOptions: FilterOption[];
  onChangeFilters: (filters: Filters) => void;
  showUnknown: boolean;
  onShowUnknown: (show: boolean) => void;
  hiddenForMissingData: number;
  activeFilters: number;
  onOpenFilters: () => void;
  onPick: (v: MapVenue) => void;
  home?: boolean;
  openNow?: boolean;
  onToggleOpenNow?: () => void;
  threeDOnly?: boolean;
  onToggleThreeD?: () => void;
  selected?: boolean;
}

export function Dock({ scanned, topPicks, saved, matches, filters, filterOptions, onChangeFilters, showUnknown, onShowUnknown, hiddenForMissingData, activeFilters, onOpenFilters, onPick, home = false, openNow = false, onToggleOpenNow, threeDOnly = false, onToggleThreeD, selected = false }: Props) {
  const [panel, setPanel] = useState<Panel>(null);
  // Phone sheet, folded to a slim bar so the map gets the screen. Remembered
  // on this device; it can't fold while the privacy notice inside it waits
  // for an answer.
  const [folded, setFoldedState] = useState(() => { try { return localStorage.getItem(FOLD_KEY) === "1"; } catch { return false; } });
  const [consentPending, setConsentPending] = useState(() => getConsent() === null);
  useEffect(() => {
    const answered = () => setConsentPending(false);
    window.addEventListener("visita:consent", answered);
    return () => window.removeEventListener("visita:consent", answered);
  }, []);
  const canFold = !consentPending;
  const setFolded = (value: boolean) => {
    setFoldedState(value);
    try { localStorage.setItem(FOLD_KEY, value ? "1" : "0"); } catch { /* private mode */ }
  };
  if (folded && consentPending) setFoldedState(false);
  // Swipe down on the sheet folds it; swipe up unfolds it. Sideways swipes
  // (the card row) are left alone.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const swipe = {
    onTouchStart: (e: React.TouchEvent) => { const t = e.touches[0]; touch.current = t ? { x: t.clientX, y: t.clientY } : null; },
    onTouchEnd: (e: React.TouchEvent) => {
      const start = touch.current; const t = e.changedTouches[0];
      touch.current = null;
      if (!start || !t || !canFold) return;
      const dx = t.clientX - start.x; const dy = t.clientY - start.y;
      if (Math.abs(dy) < 40 || Math.abs(dy) < Math.abs(dx)) return;
      setFolded(dy > 0);
    },
  };
  // The phone sheet's height, for the map buttons and credit above it (global.css --peek-h).
  const peekRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = peekRef.current;
    const root = document.documentElement;
    if (!el) return;
    const sync = () => root.style.setProperty("--peek-h", `${el.offsetHeight}px`);
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    sync();
    return () => {
      observer.disconnect();
      root.style.removeProperty("--peek-h");
    };
  }, [selected, home, folded]);
  const pick = (v: MapVenue) => {
    setPanel(null);
    onPick(v);
  };

  const pill =
    "surface-raised pointer-events-auto inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium hover:bg-muted";

  if (home) return (
    <>
      {/* Phone peek: the cafes you can step inside, as cards. "See all" opens the full list. */}
      {!selected && <section ref={peekRef} aria-label="Cafes" className="map-home-peek pointer-events-auto grid gap-3 md:hidden" {...swipe}>
        {/* The handle folds and unfolds the sheet (tap or swipe); folding waits until the privacy notice is answered. */}
        <button
          type="button"
          onClick={() => canFold && setFolded(!folded)}
          disabled={!canFold}
          aria-expanded={!folded}
          aria-label={folded ? "Show cafes" : "Hide cafes and see the map"}
          className="-my-2 grid h-7 w-full place-items-center disabled:cursor-default"
        >
          <span className="h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />
        </button>
        {folded ? (
          <button type="button" onClick={() => setFolded(false)} className="flex min-h-11 items-center justify-between gap-3 px-4.5 text-left">
            <span className="font-display text-lg">{scanned.length > 0 ? "Step inside before you go" : "Cafes in CDO"}</span>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">{matches.length} cafes <ChevronUp className="size-4" aria-hidden="true" /></span>
          </button>
        ) : (<>
        <ConsentInline />
        <div className="flex items-baseline justify-between gap-3 px-4.5">
          <h2 className="text-xl">{scanned.length > 0 ? "Step inside before you go" : "Cafes in CDO"}</h2>
          <button type="button" className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-primary" onClick={() => setPanel("browse")}>See all {matches.length}</button>
        </div>
        <ul className="flex gap-2.5 overflow-x-auto px-4.5 pb-1 [scrollbar-width:none]">
          {(scanned.length > 0 ? scanned : matches).slice(0, 8).map((v) => {
            const open = isOpenAt(v.hours, new Date());
            return (
              <li key={v.slug} className="shrink-0">
                <button type="button" className="flex w-56 flex-col gap-2 rounded-[1.25rem] border border-accent bg-card p-2.5 text-left" onClick={() => onPick(v)}>
                  <span className={cn("relative grid h-20 place-items-center rounded-2xl", v.scanned ? "bg-foreground" : "bg-accent")}>
                    <Box className={cn("size-7", v.scanned ? "text-[var(--brand-gold)]" : "text-primary")} strokeWidth={1.6} aria-hidden="true" />
                    {v.scanned && <span className="absolute top-2 left-2 rounded-full bg-verified px-2 py-0.5 text-[0.7rem] font-bold text-verified-foreground">3D</span>}
                  </span>
                  <strong className="truncate text-[0.95rem]">{v.name}</strong>
                  <small className="truncate text-xs text-muted-foreground">{[open === null ? null : open ? "Open now" : "Closed", v.distance].filter(Boolean).join(" · ") || "Hours not listed yet"}</small>
                </button>
              </li>
            );
          })}
        </ul>
        </>)}
      </section>}
      <BottomSheet open={panel === "browse"} onOpenChange={(o) => !o && setPanel(null)} title="Find a cafe" description={`${matches.length} ${matches.length === 1 ? "cafe" : "cafes"} match`}>
        <div className="grid gap-3 py-1">
          <div className="grid grid-cols-2 gap-2" aria-label="Quick cafe filters">
            <button type="button" className={cn("min-h-11 rounded-full border px-3 text-sm font-medium", threeDOnly && "border-primary bg-primary text-primary-foreground")} aria-pressed={threeDOnly} onClick={onToggleThreeD}>3D only</button>
            <button type="button" className={cn("min-h-11 rounded-full border px-3 text-sm font-medium", openNow && "border-primary bg-primary text-primary-foreground")} aria-pressed={openNow} onClick={onToggleOpenNow}>Open now</button>
          </div>
          <details className="rounded-card border px-4 py-3">
            <summary className="flex cursor-pointer items-center gap-2 font-medium"><SlidersHorizontal className="size-4" /> More filters {activeFilters > 0 && `(${activeFilters})`}</summary>
            <div className="grid gap-4 pt-4">
              <FilterControls options={filterOptions} filters={filters} onChange={onChangeFilters} />
              {hiddenForMissingData > 0 && <div className="flex items-center justify-between gap-4"><Label htmlFor="find-unknown">Include {hiddenForMissingData} {hiddenForMissingData === 1 ? "cafe" : "cafes"} with missing details</Label><Switch id="find-unknown" checked={showUnknown} onCheckedChange={onShowUnknown} /></div>}
              {activeFilters > 0 && <button type="button" className="text-left text-sm font-medium text-primary underline" onClick={() => onChangeFilters(EMPTY_FILTERS)}>Clear filters</button>}
            </div>
          </details>
          <p className="text-sm font-medium" aria-live="polite">{matches.length} matching {matches.length === 1 ? "cafe" : "cafes"}</p>
          <VenueList venues={matches} onPick={pick} empty="No cafes match these filters. Try clearing one." />
        </div>
      </BottomSheet>
    </>
  );

  return (
    <>
      <nav aria-label="Browse cafes" className={cn("gap-2", home ? "hidden grid-cols-2 py-1 md:grid" : "-mx-3 -mb-3 flex overflow-x-auto px-4 pt-1 pb-4 [scrollbar-width:none]")}>
        <button type="button" className={pill} onClick={() => setPanel("scanned")}>
          <Box className="size-4" aria-hidden="true" /> {home ? "3D Cafes" : "3D Layout"}
        </button>
        {home && <button type="button" className={cn(pill, openNow && "bg-primary text-primary-foreground")} aria-pressed={openNow} onClick={onToggleOpenNow}>
          Open now
        </button>}
        <button type="button" className={cn(pill, activeFilters > 0 && "text-primary ring-2 ring-primary/50")} onClick={onOpenFilters}>
          <SlidersHorizontal className="size-4" aria-hidden="true" /> Filter
          {activeFilters > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-primary text-[0.7rem] text-primary-foreground" aria-label={`${activeFilters} active`}>
              {activeFilters}
            </span>
          )}
        </button>
        {!home && <button type="button" className={pill} onClick={() => setPanel("top")}>
          <Star className="size-4" aria-hidden="true" /> Top Picks
        </button>}
        {!home && <button type="button" className={pill} onClick={() => setPanel("saved")}>
          <Heart className="size-4" aria-hidden="true" /> Saved{saved.length > 0 && ` (${saved.length})`}
        </button>}
        {home && <button type="button" className={pill} onClick={() => setPanel("browse")}>
          <Compass className="size-4" aria-hidden="true" /> Browse
        </button>}
      </nav>

      {home && <>
        {!selected && <button type="button" className="map-home-browse surface-raised pointer-events-auto flex items-center gap-3 text-left md:hidden" onClick={() => setPanel("browse")}>
          <span className="grid size-10 shrink-0 place-items-center rounded-card bg-accent text-primary"><Compass className="size-5" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1"><strong className="block text-sm">Explore CDO</strong><small className="block text-xs text-muted-foreground">Browse cafes and top picks</small></span>
          <ChevronUp className="size-5 shrink-0" aria-hidden="true" />
        </button>}
      </>}

      {home && <BottomSheet open={panel === "browse"} onOpenChange={(o) => !o && setPanel(null)} title="Explore CDO" description="Browse cafes while the map stays in view.">
        <div className="grid gap-3 py-1">
          <div className="grid grid-cols-2 gap-2 pb-2 md:hidden" aria-label="Quick cafe filters">
            <button type="button" className={cn("flex min-h-11 items-center justify-center gap-2 rounded-full border px-3 text-sm font-medium", threeDOnly && "border-primary bg-primary text-primary-foreground")} aria-pressed={threeDOnly} onClick={onToggleThreeD}>
              <Box className="size-4" aria-hidden="true" /> 3D only
            </button>
            <button type="button" className={cn("flex min-h-11 items-center justify-center rounded-full border px-3 text-sm font-medium", openNow && "border-primary bg-primary text-primary-foreground")} aria-pressed={openNow} onClick={onToggleOpenNow}>Open now</button>
          </div>
          <button type="button" className="flex min-h-14 items-center gap-3 rounded-card border bg-card px-4 text-left font-medium" onClick={() => setPanel("scanned")}>
            <Box className="size-5 text-primary" aria-hidden="true" /> 3D cafes <span className="ml-auto text-xs text-muted-foreground">{scanned.length}</span>
          </button>
          <button type="button" className="flex min-h-14 items-center gap-3 rounded-card border bg-card px-4 text-left font-medium" onClick={() => setPanel("top")}>
            <Star className="size-5 text-primary" aria-hidden="true" /> Top Picks
          </button>
          <button type="button" className="flex min-h-14 items-center gap-3 rounded-card border bg-card px-4 text-left font-medium" onClick={() => setPanel("saved")}>
            <Heart className="size-5 text-primary" aria-hidden="true" /> Saved cafes{saved.length > 0 && ` (${saved.length})`}
          </button>
        </div>
      </BottomSheet>}

      <BottomSheet open={panel === "scanned"} onOpenChange={(o) => !o && setPanel(null)} title="Cafes you can step inside" description={`${scanned.length} scanned in 3D`}>
        <VenueList venues={scanned} onPick={pick} empty="No scanned cafes yet." />
      </BottomSheet>
      <BottomSheet open={panel === "top"} onOpenChange={(o) => !o && setPanel(null)} title="Top Picks">
        <VenueList venues={topPicks} onPick={pick} empty="No top picks yet." />
      </BottomSheet>
      <BottomSheet open={panel === "saved"} onOpenChange={(o) => !o && setPanel(null)} title="Saved">
        <VenueList venues={saved} onPick={pick} empty="Tap the heart on a scanned cafe to keep it here." />
      </BottomSheet>
    </>
  );
}

import { useEffect, useState, type ReactNode } from "react";
import { Box, ChevronLeft, Coffee, PanelLeftClose, PanelLeftOpen, SlidersHorizontal } from "lucide-react";
import { cn } from "@visita/ui/utils";
import type { MapVenue } from "@/lib/discovery/venues";
import { isOpenAt } from "@/lib/venue/hours";

// The home page's list on a computer (approved redesign v2, 2026-11-14): a
// floating card under the floating header with headline, search, quick
// filters and the cafe list. Selecting a cafe swaps the card to its details;
// "All cafes" goes back. The panel button folds the card into one bar
// (search + "Show list"), remembered on this device. Phones keep the
// floating controls and bottom sheets.

type Ranked = MapVenue & { distance: string | null };

interface Props {
  /** Renders the search field; `wide` when it sits in the folded bar. */
  search: (wide: boolean) => ReactNode;
  /** The selected cafe's details panel, when one is selected. */
  details: ReactNode;
  onBack: () => void;
  matches: Ranked[];
  total: number;
  selected: string | null;
  onPick: (v: MapVenue) => void;
  threeDOnly: boolean;
  onToggleThreeD: () => void;
  openNow: boolean;
  onToggleOpenNow: () => void;
  activeFilters: number;
  onOpenFilters: () => void;
  /** The card's heading and line under it (home vs /explore). */
  title?: string;
  lede?: string;
  /** The desktop filter panel is open beside the card. */
  filtersOpen?: boolean;
}

const COLLAPSED_KEY = "visita:list-collapsed";
const chip = "inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors hover:bg-accent";
const chipOn = "border-foreground bg-foreground text-white hover:bg-foreground";
const card = "surface-raised pointer-events-auto absolute top-24 left-4 z-20 w-[22rem] lg:w-[26.25rem]";
const roundButton = "grid size-10 shrink-0 place-items-center rounded-full bg-muted hover:bg-accent";

function readCollapsed(): boolean {
  try { return localStorage.getItem(COLLAPSED_KEY) === "1"; } catch { return false; }
}

export function HomeRail(props: Props) {
  const [collapsed, setCollapsedState] = useState(readCollapsed);
  const setCollapsed = (value: boolean) => {
    setCollapsedState(value);
    try { localStorage.setItem(COLLAPSED_KEY, value ? "1" : "0"); } catch { /* private mode */ }
  };
  // Tell the page the list is folded, so the privacy notice can take the
  // left column (global.css, html[data-list-folded]).
  useEffect(() => {
    const root = window.document.documentElement;
    root.toggleAttribute("data-list-folded", collapsed);
    return () => {
      root.removeAttribute("data-list-folded");
    };
  }, [collapsed]);
  // Picking a pin on the map while folded opens the card on that cafe.
  useEffect(() => {
    if (props.details && collapsed) setCollapsedState(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.selected]);

  if (collapsed) {
    return (
      <div className={cn(card, "flex h-15 items-center gap-2 rounded-full pr-2 pl-1")}>
        <div className="min-w-0 flex-1 [&_label]:h-12 [&_label]:border-0 [&_label]:bg-transparent">{props.search(true)}</div>
        <button type="button" onClick={() => setCollapsed(false)} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-semibold text-white">
          <PanelLeftOpen className="size-4" aria-hidden="true" /> Show list · {props.total}
        </button>
      </div>
    );
  }

  const hide = (
    <button type="button" className={roundButton} aria-label="Hide list" title="Hide list" onClick={() => setCollapsed(true)}>
      <PanelLeftClose className="size-[1.125rem]" aria-hidden="true" />
    </button>
  );

  if (props.details) {
    return (
      <aside aria-label="Cafe details" className={cn(card, "bottom-4 flex flex-col overflow-hidden rounded-card")}>
        <div className="flex shrink-0 items-center gap-2 px-3 pt-3">
          <button type="button" onClick={props.onBack} className="inline-flex h-10 items-center gap-1 rounded-full pr-3.5 pl-2 text-sm font-semibold hover:bg-accent">
            <ChevronLeft className="size-5" aria-hidden="true" /> All cafes
          </button>
          <span className="ml-auto">{hide}</span>
        </div>
        <div className="scroll-soft min-h-0 flex-1 overflow-y-auto overscroll-contain">{props.details}</div>
      </aside>
    );
  }

  const { matches } = props;
  const scanned = matches.filter((v) => v.scanned);
  const others = matches.filter((v) => !v.scanned);
  const now = new Date();

  return (
    <aside aria-label="Find a cafe" className={cn(card, "bottom-4 flex flex-col overflow-hidden rounded-card")}>
      <div className="grid shrink-0 gap-3.5 px-5.5 pt-5.5 pb-3.5">
        <div className="flex items-start gap-3">
          <h2 className="flex-1 text-[2rem] leading-[1.05]">{props.title ?? "Step inside from anywhere."}</h2>
          {hide}
        </div>
        <p className="text-sm text-muted-foreground">
          {props.lede ?? "Walk through real, unedited 3D scans of cafes in Cagayan de Oro before you go."}
        </p>
        {props.search(false)}
        <div className="flex flex-wrap gap-2" aria-label="Quick cafe filters">
          <button type="button" className={cn(chip, props.threeDOnly && chipOn)} aria-pressed={props.threeDOnly} onClick={props.onToggleThreeD}>
            <Box className="size-4" aria-hidden="true" /> 3D only
          </button>
          <button type="button" className={cn(chip, props.openNow && chipOn)} aria-pressed={props.openNow} onClick={props.onToggleOpenNow}>
            Open now
          </button>
          <button type="button" className={cn(chip, (props.activeFilters > 0 || props.filtersOpen) && "border-primary text-primary", props.filtersOpen && "ring-1 ring-primary")} aria-expanded={props.filtersOpen} onClick={props.onOpenFilters}>
            <SlidersHorizontal className="size-4" aria-hidden="true" /> Filters
            {props.activeFilters > 0 && (
              <span className="grid size-5 place-items-center rounded-full bg-primary text-[0.7rem] text-primary-foreground" aria-label={`${props.activeFilters} active`}>
                {props.activeFilters}
              </span>
            )}
          </button>
        </div>
        {/* The map's pin key lives with the list it describes. */}
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-verified" aria-hidden="true" />Amber pin: step inside in 3D</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-foreground" aria-hidden="true" />Navy pin: details only</span>
        </p>
      </div>

      <div className="mx-5.5 h-px shrink-0 bg-accent" />
      <div className="scroll-soft min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-3 pb-1">
        {matches.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">No cafes match these filters. Try clearing one.</p>}
        {scanned.length > 0 && (
          <Group title={`${scanned.length} ${scanned.length === 1 ? "cafe" : "cafes"} you can step inside`}>
            {scanned.map((v) => <Row key={v.slug} venue={v} now={now} selected={props.selected === v.slug} onPick={props.onPick} />)}
          </Group>
        )}
        {others.length > 0 && (
          <Group title={scanned.length > 0 ? "More cafes, details only" : `${others.length} ${others.length === 1 ? "cafe" : "cafes"}`}>
            {others.map((v) => <Row key={v.slug} venue={v} now={now} selected={props.selected === v.slug} onPick={props.onPick} />)}
          </Group>
        )}
      </div>
    </aside>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-1 pb-2" aria-label={title}>
      <p className="px-2.5 pt-1 pb-1 text-[0.8rem] font-semibold text-muted-foreground">{title}</p>
      <ul className="grid gap-1">{children}</ul>
    </section>
  );
}

function Row({ venue: v, now, selected, onPick }: { venue: Ranked; now: Date; selected: boolean; onPick: (v: MapVenue) => void }) {
  const open = isOpenAt(v.hours, now);
  const meta = [open === null ? null : open ? "Open now" : "Closed", v.distance].filter(Boolean).join(" · ");
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(v)}
        aria-current={selected || undefined}
        className={cn("flex w-full items-center gap-3.5 rounded-[1.25rem] border border-transparent p-2.5 text-left transition-colors hover:border-border", selected && "border-border bg-muted")}
      >
        <span className={cn("grid size-[4.5rem] shrink-0 place-items-center rounded-2xl", v.scanned ? "bg-foreground" : "bg-accent")}>
          {v.scanned
            ? <Box className="size-7 text-[var(--brand-gold)]" strokeWidth={1.6} aria-hidden="true" />
            : <Coffee className="size-6 text-primary" strokeWidth={1.8} aria-hidden="true" />}
        </span>
        <span className="grid min-w-0 flex-1 gap-1">
          <span className="truncate font-semibold">{v.name}</span>
          <span className="truncate text-[0.8rem] text-muted-foreground">{meta || "Hours not listed yet"}</span>
          {(v.scanned || v.isTopPick) && (
            <span className="flex flex-wrap gap-1.5">
              {v.scanned && <span className="rounded-full bg-verified px-2 py-0.5 text-[0.7rem] font-bold text-verified-foreground">3D</span>}
              {v.isTopPick && <span className="rounded-full bg-accent px-2 py-0.5 text-[0.7rem] font-semibold text-primary">Top pick</span>}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

import type { AmenityEntry } from "@visita/shared-types";
import { WEEKDAYS } from "../venue/hours";
import type { MapVenue } from "./venues";

// PRD 4.1 filters: price range, minimum outlets, Wi-Fi, open 24/7, outdoor,
// parking. Each one answers match, fail or unknown for a venue. A cafe that
// doesn't list something being filtered on is hidden rather than guessed at,
// with a one-tap "show them anyway" that brings back only the unknowns,
// never a cafe that fails.

export interface Filters {
  priceMin: number | null;
  priceMax: number | null;
  minOutlets: number | null;
  wifi: boolean;
  open247: boolean;
  outdoor: boolean;
  parking: boolean;
}

export const EMPTY_FILTERS: Filters = {
  priceMin: null,
  priceMax: null,
  minOutlets: null,
  wifi: false,
  open247: false,
  outdoor: false,
  parking: false,
};

type Verdict = "match" | "fail" | "unknown";

/** Cheapest and dearest priced menu item, or null when nothing has a price. */
export function priceRange(v: MapVenue): [number, number] | null {
  const prices = v.menu.map((m) => m.price_php).filter((p): p is number => typeof p === "number");
  return prices.length ? [Math.min(...prices), Math.max(...prices)] : null;
}

const flag = (entry: AmenityEntry | undefined): Verdict =>
  typeof entry?.value === "boolean" ? (entry.value ? "match" : "fail") : "unknown";

function verdicts(v: MapVenue, f: Filters): Verdict[] {
  const out: Verdict[] = [];

  if (f.priceMin !== null || f.priceMax !== null) {
    const range = priceRange(v);
    if (!range) out.push("unknown");
    else {
      const [lo, hi] = range;
      const overlaps = (f.priceMax === null || lo <= f.priceMax) && (f.priceMin === null || hi >= f.priceMin);
      out.push(overlaps ? "match" : "fail");
    }
  }

  if (f.minOutlets !== null) {
    const n = v.amenities.power_outlets?.value;
    out.push(typeof n === "number" ? (n >= f.minOutlets ? "match" : "fail") : "unknown");
  }

  if (f.wifi) out.push(flag(v.amenities.wifi));
  if (f.outdoor) out.push(flag(v.amenities.outdoor));
  if (f.parking) out.push(flag(v.amenities.parking));

  if (f.open247) {
    const h = v.hours;
    if (!h || !WEEKDAYS.every((d) => d in h)) out.push("unknown");
    else out.push(WEEKDAYS.every((d) => h[d] && h[d]![0] === h[d]![1]) ? "match" : "fail");
  }

  return out;
}

export interface FilterResult {
  /** Venues that satisfy every active filter. */
  matches: MapVenue[];
  /** What to display: matches, then (if asked) venues with only unknowns. */
  shown: MapVenue[];
  /** Venues hidden only because they don't list a filtered detail. */
  hiddenForMissingData: number;
}

export function applyFilters(venues: MapVenue[], f: Filters, showUnknown: boolean): FilterResult {
  const matches: MapVenue[] = [];
  const unknown: MapVenue[] = [];
  for (const v of venues) {
    const vs = verdicts(v, f);
    if (vs.includes("fail")) continue;
    if (vs.includes("unknown")) unknown.push(v);
    else matches.push(v);
  }
  return {
    matches,
    shown: showUnknown ? [...matches, ...unknown] : matches,
    hiddenForMissingData: unknown.length,
  };
}

export function activeFilterCount(f: Filters): number {
  return (
    Number(f.priceMin !== null || f.priceMax !== null) +
    Number(f.minOutlets !== null) +
    Number(f.wifi) +
    Number(f.open247) +
    Number(f.outdoor) +
    Number(f.parking)
  );
}

/** Names of the active filters, for analytics ("which filters brought people in"). */
export const FILTER_NAMES = ["price", "outlets", "wifi", "open247", "outdoor", "parking"] as const;
export type FilterName = (typeof FILTER_NAMES)[number];

export function activeFilterNames(f: Filters): FilterName[] {
  const on: Record<FilterName, boolean> = {
    price: f.priceMin !== null || f.priceMax !== null,
    outlets: f.minOutlets !== null,
    wifi: f.wifi,
    open247: f.open247,
    outdoor: f.outdoor,
    parking: f.parking,
  };
  return FILTER_NAMES.filter((n) => on[n]);
}

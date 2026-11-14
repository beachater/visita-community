import type { AmenityDefinition, AmenityEntry } from "@visita/shared-types";
import { WEEKDAYS } from "../venue/hours";
import type { MapVenue } from "./venues";

// PRD 4.1 filters. Two are built in because they come from the menu and the
// hours, not from amenities: menu price and open 24/7. Every other filter
// comes from `amenity_definitions` rows with `is_filterable = true`: a yes/no
// amenity becomes a "must have" toggle, a number amenity a "N or more" choice.
// Turning a filter on or off is a data change, not a deploy.
//
// Each filter answers match, fail or unknown for a venue. A cafe that doesn't
// list something being filtered on is hidden rather than guessed at, with a
// one-tap "show them anyway" that brings back only the unknowns, never a
// cafe that fails.

export interface Filters {
  priceMin: number | null;
  priceMax: number | null;
  open247: boolean;
  /** Yes/no amenities that must be yes, by amenity key ("wifi"). */
  required: string[];
  /** Number amenities with a minimum, by amenity key ({ power_outlets: 3 }). */
  minimums: Record<string, number>;
}

export const EMPTY_FILTERS: Filters = {
  priceMin: null,
  priceMax: null,
  open247: false,
  required: [],
  minimums: {},
};

/** One amenity filter, built from its definition. */
export interface FilterOption {
  key: string;
  label: string;
  icon: string | null;
  kind: "flag" | "minimum";
  /** "N or more" choices for a number amenity. */
  steps: number[];
}

export const PRICE_CAPS = [100, 150, 200, 300, 500];
const DEFAULT_STEPS = [1, 3, 5, 10];

/** The amenity filters to offer, in the definitions' order. */
export function filterOptions(definitions: AmenityDefinition[]): FilterOption[] {
  return definitions
    .filter((d) => d.is_filterable && d.is_active && (d.value_type === "boolean" || d.value_type === "number"))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((d) => ({
      key: d.key,
      label: d.label,
      icon: d.icon,
      kind: d.value_type === "boolean" ? "flag" : "minimum",
      steps: DEFAULT_STEPS,
    }));
}

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

  for (const [key, min] of Object.entries(f.minimums)) {
    const n = v.amenities[key]?.value;
    out.push(typeof n === "number" ? (n >= min ? "match" : "fail") : "unknown");
  }

  for (const key of f.required) out.push(flag(v.amenities[key]));

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
  return Number(f.priceMin !== null || f.priceMax !== null) + Number(f.open247) + f.required.length + Object.keys(f.minimums).length;
}

/** Turn one amenity filter on or off. */
export function toggleRequired(f: Filters, key: string): Filters {
  return { ...f, required: f.required.includes(key) ? f.required.filter((k) => k !== key) : [...f.required, key] };
}

/** Set or clear (null) a number amenity's minimum. */
export function setMinimum(f: Filters, key: string, min: number | null): Filters {
  const minimums = { ...f.minimums };
  if (min === null) delete minimums[key];
  else minimums[key] = min;
  return { ...f, minimums };
}

// Analytics names ("which filters brought people in"): "price", "open247",
// and the amenity key. Older names are kept so owner charts stay continuous.
const ANALYTICS_ALIAS: Record<string, string> = { power_outlets: "outlets" };
const FILTER_NAME = /^[a-z][a-z0-9_]{0,39}$/;

/** Whether a name sent by the browser is a well-formed filter name. */
export const isFilterName = (name: string): boolean => FILTER_NAME.test(name);

export function activeFilterNames(f: Filters): string[] {
  const names: string[] = [];
  if (f.priceMin !== null || f.priceMax !== null) names.push("price");
  for (const key of Object.keys(f.minimums)) names.push(ANALYTICS_ALIAS[key] ?? key);
  for (const key of f.required) names.push(ANALYTICS_ALIAS[key] ?? key);
  if (f.open247) names.push("open247");
  return names;
}

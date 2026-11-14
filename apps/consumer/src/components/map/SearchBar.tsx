import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@visita/ui/utils";
import { useStore } from "@nanostores/react";
import { track } from "@/lib/analytics/track";
import { normalize, searchVenues } from "@/lib/discovery/search";
import type { MapVenue } from "@/lib/discovery/venues";
import { $recent } from "@/lib/visitor/stores";
import { VenueList } from "./VenueList";

// PRD 4.1 search over Visita's own cafes, with the last five viewed shown
// while the box is empty.

/** Venues already counted as appearing for a search term in this tab (PRD 4.4 "search appearances"). */
const counted = new Set<string>();

interface Props {
  venues: MapVenue[];
  onPick: (v: MapVenue) => void;
  home?: boolean;
  /** Solid field for the home page's left column on a computer. */
  rail?: boolean;
  /** Results open under the surrounding bar (its full width), not just the field. */
  wide?: boolean;
}

export function SearchBar({ venues, onPick, home = false, rail = false, wide = false }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const recentSlugs = useStore($recent);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchVenues(venues, query), [venues, query]);
  const recent = useMemo(
    () => recentSlugs.map((s) => venues.find((v) => v.slug === s)).filter((v): v is MapVenue => Boolean(v)),
    [recentSlugs, venues],
  );
  const showingRecent = query.trim() === "";

  // Count an appearance once the results settle, not on every keystroke.
  useEffect(() => {
    const term = normalize(query);
    if (!term || results.length === 0) return;
    const timer = window.setTimeout(() => {
      for (const v of results) {
        const key = `${term}|${v.id}`;
        if (counted.has(key)) continue;
        counted.add(key);
        track("search_appearance", v.id);
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [query, results]);
  const list = showingRecent ? recent : results;

  const pick = (v: MapVenue) => {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    onPick(v);
  };

  return (
    <div
      className={cn("pointer-events-auto w-full", !wide && "relative")}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <div className="flex gap-2">
      <label className={cn("flex min-w-0 flex-1 items-center gap-2 focus-within:outline-2 focus-within:outline-ring", rail ? "h-13 rounded-full border bg-muted px-5" : home ? "surface-raised h-13 rounded-full px-4" : "surface-raised h-12 rounded-full px-4")}>
        <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Search cafes</span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            }
            if (e.key === "Enter" && results[0]) pick(results[0]);
          }}
          placeholder={home || rail ? "Search cafes in CDO" : "Where do you want to go today?"}
          aria-controls={listId}
          aria-expanded={open}
          role="combobox"
          aria-autocomplete="list"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none"
        />
        {query && (
          <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="grid size-8 place-items-center rounded-full hover:bg-white/70">
            <X className="size-4" />
          </button>
        )}
      </label>
      </div>

      {open && (list.length > 0 || !showingRecent) && (
        <div id={listId} className={cn("surface-raised absolute inset-x-0 z-20 max-h-[50dvh] overflow-y-auto rounded-card px-4 py-2", wide ? "top-[calc(100%+0.5rem)]" : home || rail ? "top-[3.75rem]" : "top-14")}>
          {showingRecent && <p className="px-1 pt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Recently viewed</p>}
          <VenueList venues={list} onPick={pick} empty={`No cafes on Visita match "${query.trim()}" yet.`} />
        </div>
      )}
    </div>
  );
}

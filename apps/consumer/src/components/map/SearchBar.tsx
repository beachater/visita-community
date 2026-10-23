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
}

export function SearchBar({ venues, onPick, home = false }: Props) {
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
      className="pointer-events-auto relative w-full"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <div className="flex gap-2">
      <label className={cn("glass flex min-w-0 flex-1 items-center gap-2 focus-within:outline-2 focus-within:outline-ring", home ? "h-13 rounded-[1.25rem] px-4 md:h-14 md:rounded-card md:px-5" : "h-12 rounded-full px-4")}>
        {home && <><span className="hidden shrink-0 font-display text-2xl font-bold tracking-tight md:inline">Visita</span><span className="mx-2 hidden h-6 w-px shrink-0 bg-border md:block" aria-hidden="true" /></>}
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
          placeholder={home ? "Search cafes in CDO" : "Where do you want to go today?"}
          aria-controls={listId}
          aria-expanded={open}
          role="combobox"
          aria-autocomplete="list"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="grid size-8 place-items-center rounded-full hover:bg-white/70">
            <X className="size-4" />
          </button>
        )}
      </label>
      </div>

      {open && (list.length > 0 || !showingRecent) && (
        <div id={listId} className={cn("surface-raised absolute inset-x-0 z-20 max-h-[50dvh] overflow-y-auto rounded-card px-4 py-2", home ? "top-[3.75rem]" : "top-14")}>
          {showingRecent && <p className="px-1 pt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Recently viewed</p>}
          <VenueList venues={list} onPick={pick} empty={`No cafes on Visita match "${query.trim()}" yet.`} />
        </div>
      )}
    </div>
  );
}

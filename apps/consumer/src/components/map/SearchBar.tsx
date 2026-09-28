import { useId, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useStore } from "@nanostores/react";
import { searchVenues } from "@/lib/discovery/search";
import type { MapVenue } from "@/lib/discovery/venues";
import { $recent } from "@/lib/visitor/stores";
import { VenueList } from "./VenueList";

// PRD 4.1 search over Visita's own cafes, with the last five viewed shown
// while the box is empty.

interface Props {
  venues: MapVenue[];
  onPick: (v: MapVenue) => void;
}

export function SearchBar({ venues, onPick }: Props) {
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
      <label className="flex h-12 items-center gap-2 rounded-full border bg-card px-4 shadow-lg focus-within:outline-2 focus-within:outline-ring">
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
          placeholder="Where do you want to go today?"
          aria-controls={listId}
          aria-expanded={open}
          role="combobox"
          aria-autocomplete="list"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="grid size-8 place-items-center rounded-full hover:bg-accent">
            <X className="size-4" />
          </button>
        )}
      </label>

      {open && (list.length > 0 || !showingRecent) && (
        <div id={listId} className="absolute inset-x-0 top-14 z-20 max-h-[50dvh] overflow-y-auto rounded-2xl border bg-card px-3 py-1 shadow-xl">
          {showingRecent && <p className="px-1 pt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Recently viewed</p>}
          <VenueList venues={list} onPick={pick} empty={`No cafes on Visita match "${query.trim()}" yet.`} />
        </div>
      )}
    </div>
  );
}

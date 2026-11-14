import { useEffect, useMemo, useState } from "react";
import { useStore } from "@nanostores/react";
import { Box, Coffee, Heart, MapPin, Smartphone } from "lucide-react";
import { cn } from "@visita/ui/utils";
import { fetchVenues } from "@/lib/discovery/api";
import type { MapVenue } from "@/lib/discovery/venues";
import { todaySummary } from "@/lib/venue/hours";
import { hasAuthCookie } from "@/lib/visitor/merge";
import { $saved, toggleSaved } from "@/lib/visitor/stores";

// /saved (PRD 4.1 dock "Saved", as a page; approved redesign 2026-11-14).
// Works signed out from this device's list; signed in, the store merges in
// the account's list. Computers get cards, phones compact rows.

interface Props {
  loginHref: string;
}

const pill = "inline-flex h-11 items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors";

export function SavedList({ loginHref }: Props) {
  const slugs = useStore($saved);
  const [venues, setVenues] = useState<MapVenue[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [signedIn, setSignedIn] = useState(true);

  useEffect(() => {
    setSignedIn(hasAuthCookie(document.cookie));
    const ctrl = new AbortController();
    fetchVenues(ctrl.signal)
      .then((d) => setVenues(d.venues))
      .catch(() => {
        if (!ctrl.signal.aborted) setFailed(true);
      });
    return () => ctrl.abort();
  }, []);

  const saved = useMemo(
    () => (venues ? slugs.map((s) => venues.find((v) => v.slug === s)).filter((v): v is MapVenue => Boolean(v)) : []),
    [slugs, venues],
  );
  const now = new Date();

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase" aria-live="polite">
          Your list{venues !== null && ` · ${saved.length} ${saved.length === 1 ? "cafe" : "cafes"}`}
        </p>
        {saved.length > 0 && (
          <a href="/explore" className={cn(pill, "border border-border bg-card text-foreground hover:bg-accent")}>
            <MapPin className="mr-2 size-4" aria-hidden="true" /> See them on the map
          </a>
        )}
      </div>

      {!signedIn && (
        <p className="flex items-center gap-3 rounded-[1.25rem] bg-card px-4 py-3 text-sm">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-primary" aria-hidden="true"><Smartphone className="size-4" /></span>
          <span className="flex-1">These are saved on this device only. Sign in to keep them on every device.</span>
          <a href={loginHref} className="font-semibold text-primary underline-offset-2 hover:underline">Sign in</a>
        </p>
      )}
      {failed && <p role="alert" className="text-sm text-destructive">Couldn't load cafes. Check your connection and reload.</p>}
      {venues === null && !failed && <p className="text-sm text-muted-foreground">Loading…</p>}

      {venues !== null && saved.length === 0 && (
        <div className="grid justify-items-center gap-3 rounded-card border-[1.5px] border-dashed border-mist px-6 py-12 text-center">
          <span className="grid size-13 place-items-center rounded-full bg-card text-primary" aria-hidden="true"><Heart className="size-5" /></span>
          <p className="font-display text-lg">No saved cafes yet</p>
          <p className="max-w-[44ch] text-sm text-muted-foreground">Tap the heart on any cafe to keep it here.</p>
          <a href="/explore" className={cn(pill, "bg-primary text-primary-foreground hover:bg-primary/90")}>Explore the map</a>
        </div>
      )}

      {saved.length > 0 && (
        <ul className="grid gap-2.5 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {saved.map((v) => {
            const today = todaySummary(v.hours, now);
            const meta = [today.open === null ? null : today.hours ?? null].filter(Boolean).join(" · ");
            return (
              <li key={v.slug} className="relative flex items-center gap-3 rounded-[1.375rem] bg-card p-2.5 shadow-card sm:flex-col sm:items-stretch sm:gap-0 sm:overflow-hidden sm:rounded-card sm:p-0">
                {/* Picture area: a small tile on phones, the card's top on computers. */}
                <a href={`/cafe/${v.slug}`} className={cn("relative grid size-17 shrink-0 place-items-center rounded-2xl sm:h-44 sm:w-full sm:rounded-none", v.scanned ? "bg-scan" : "bg-accent")} aria-label={v.name}>
                  {v.scanned ? <Box className="size-7 text-[var(--brand-gold)] sm:size-11" strokeWidth={1.4} aria-hidden="true" /> : <Coffee className="size-6 text-primary sm:size-10" strokeWidth={1.6} aria-hidden="true" />}
                  <span className={cn("absolute top-3.5 left-3.5 hidden rounded-full px-2.5 py-1 text-xs sm:inline", v.scanned ? "bg-verified font-bold text-verified-foreground" : "bg-card font-semibold text-muted-foreground")}>
                    {v.scanned ? "Scanned in 3D" : "Not scanned yet"}
                  </span>
                </a>
                <div className="grid min-w-0 flex-1 gap-1 sm:gap-2.5 sm:p-4.5">
                  <a href={`/cafe/${v.slug}`} className="truncate font-semibold sm:font-display sm:text-xl">{v.name}</a>
                  <p className="truncate text-xs text-muted-foreground sm:text-[0.8rem]">
                    {today.open !== null && <span className={cn("font-semibold", today.open ? "text-success" : "")}>{today.open ? "Open now" : "Closed"}</span>}
                    {meta && ` · ${meta}`}
                    {today.open === null && "Hours not listed yet"}
                  </p>
                  {v.scanned && <span className="w-fit rounded-full bg-verified px-2 py-px text-[0.7rem] font-bold text-verified-foreground sm:hidden">3D</span>}
                  <div className="hidden gap-2 pt-1 sm:flex">
                    {v.scanned && <a href={`/cafe/${v.slug}`} className={cn(pill, "flex-1 bg-primary text-primary-foreground hover:bg-primary/90")}>Step inside</a>}
                    <a href={`/cafe/${v.slug}`} className={cn(pill, "border border-border text-foreground hover:bg-accent", !v.scanned && "flex-1")}>Details</a>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${v.name} from saved`}
                  onClick={() => toggleSaved(v.slug)}
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-primary hover:bg-accent sm:absolute sm:top-2.5 sm:right-2.5 sm:size-10 sm:bg-card/95 sm:shadow-float"
                >
                  <Heart className="size-[1.125rem] fill-current" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@nanostores/react";
import { Heart } from "lucide-react";
import { Button } from "@visita/ui/button";
import { fetchVenues } from "@/lib/discovery/api";
import type { MapVenue } from "@/lib/discovery/venues";
import { hasAuthCookie } from "@/lib/visitor/merge";
import { $saved, toggleSaved } from "@/lib/visitor/stores";
import { VenueList } from "../map/VenueList";

// /saved (PRD 4.1 dock "Saved", as a page). Works signed out from this
// device's list; signed in, the store merges in the account's list.

interface Props {
  loginHref: string;
}

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

  return (
    <div className="grid gap-6">
      {!signedIn && (
        <p className="rounded-card bg-card shadow-card px-5 py-4 text-sm">
          These are saved on this device only.{" "}
          <a href={loginHref} className="font-medium underline">
            Sign in
          </a>{" "}
          to keep them on every device.
        </p>
      )}
      {failed && <p role="alert" className="text-sm text-destructive">Couldn't load cafes. Check your connection and reload.</p>}
      {venues === null && !failed && <p className="text-sm text-muted-foreground">Loading…</p>}
      {venues !== null && saved.length === 0 && (
        <div className="grid justify-items-center gap-3 rounded-card border border-dashed border-mist bg-card/70 px-6 py-10 text-center">
          <p className="font-medium">No saved cafes yet</p>
          <p className="max-w-[48ch] text-sm text-muted-foreground">Tap the heart inside a 3D walkthrough to keep a cafe here.</p>
          <Button asChild>
            <a href="/explore">Explore the map</a>
          </Button>
        </div>
      )}
      {saved.length > 0 && (
        <ul className="grid gap-2">
          {saved.map((v) => (
            <li key={v.slug} className="flex items-center gap-2 rounded-card bg-card shadow-card px-4">
              <div className="min-w-0 flex-1">
                <VenueList venues={[v]} onPick={() => (window.location.href = `/cafe/${v.slug}`)} />
              </div>
              <Button variant="ghost" size="icon" aria-label={`Remove ${v.name} from saved`} onClick={() => toggleSaved(v.slug)}>
                <Heart className="size-5 fill-current text-primary" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

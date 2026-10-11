import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Link, Outlet, useParams } from "react-router";
import { ExternalLink } from "lucide-react";
import type { MenuItem, VenueAmenities, VenueType, WeeklyHours } from "@visita/shared-types";
import { Button } from "@visita/ui/button";
import { CONSUMER_URL, supabase } from "@/lib/supabase";

// An approved owner's area for one venue (PRD 4.4): overview and occupancy,
// the listing (menu, hours, amenities), events, and reviews. RLS decides what
// loads; a venue that isn't theirs simply doesn't come back. Its pages are
// listed under the cafe in the sidebar (routes/nav.ts).

export interface OwnedVenue {
  id: string;
  name: string;
  slug: string;
  venue_type: VenueType;
  address: string | null;
  is_published: boolean;
  splat_url: string | null;
  menu: MenuItem[];
  hours: WeeklyHours | null;
  amenities: VenueAmenities;
}

interface VenueState {
  venue: OwnedVenue;
  reload: () => Promise<void>;
}

const VenueContext = createContext<VenueState | null>(null);

export function useVenue(): VenueState {
  const ctx = useContext(VenueContext);
  if (!ctx) throw new Error("useVenue must be used inside VenueLayout");
  return ctx;
}

export function VenueLayout() {
  const { venueId = "" } = useParams();
  const [venue, setVenue] = useState<OwnedVenue | null | undefined>(undefined);

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from("venues")
      .select("id, name, slug, venue_type, address, is_published, splat_url, menu, hours, amenities")
      .eq("id", venueId)
      .maybeSingle();
    setVenue(
      data
        ? {
            ...data,
            menu: (data.menu as unknown as MenuItem[]) ?? [],
            hours: data.hours as WeeklyHours | null,
            amenities: (data.amenities as VenueAmenities) ?? {},
          }
        : null,
    );
  }, [venueId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (venue === undefined) return <p className="text-muted-foreground">Loading…</p>;
  if (venue === null)
    return (
      <div className="grid gap-3">
        <p>This cafe isn't one you manage.</p>
        <Link to="/" className="w-fit underline">
          Go back
        </Link>
      </div>
    );

  return (
    <VenueContext.Provider value={{ venue, reload }}>
      <div className="grid gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-1">
            <h1 className="font-display text-3xl font-bold">{venue.name}</h1>
            {venue.address && <p className="text-muted-foreground">{venue.address}</p>}
            <p className="text-sm">
              {venue.is_published ? (
                <span className="text-success">Live on Visita</span>
              ) : (
                <span className="text-muted-foreground">Not published yet. Visita's team publishes new listings after a first check.</span>
              )}
            </p>
          </div>
          {venue.is_published && (
            <Button asChild variant="outline">
              <a href={`${CONSUMER_URL}/cafe/${venue.slug}`} target="_blank" rel="noopener">
                <ExternalLink /> View your listing
              </a>
            </Button>
          )}
        </header>
        <Outlet />
      </div>
    </VenueContext.Provider>
  );
}

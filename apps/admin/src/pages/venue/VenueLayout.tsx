import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Link, Outlet, useParams } from "react-router";
import { ArrowLeftRight, Eye } from "lucide-react";
import type { MenuItem, VenueAmenities, VenueType, WeeklyHours } from "@visita/shared-types";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/lib/supabase";

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
  const { access } = useAuth();
  // The cafe's name and identity live in the sidebar; an admin who doesn't
  // own this cafe is previewing the owner's view.
  const previewing = Boolean(access?.isAdmin) && !access?.claims.some((c) => c.venueId === venueId && c.status === "approved");

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
        {previewing && (
          // An admin seeing a cafe they don't own: always say whose view this is.
          <div role="status" className="flex flex-wrap items-center gap-3 rounded-[1.75rem] bg-scan py-2.5 pr-2.5 pl-5 text-white shadow-card sm:rounded-full">
            <Eye className="size-4.5 shrink-0 text-gold" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-sm">
              <b>Previewing as the owner of {venue.name}.</b>{" "}
              <span className="text-mist">This is their view. Changes you make here are real and go live.</span>
            </p>
            <Link to="/admin/approvals" className="inline-flex h-10 items-center gap-2 rounded-full bg-card px-4 text-sm font-semibold text-foreground hover:bg-cloud">
              <ArrowLeftRight className="size-4" aria-hidden="true" /> Back to admin
            </Link>
          </div>
        )}
        {!venue.is_published && (
          <p className="rounded-[1.25rem] bg-card px-4 py-3 text-sm text-muted-foreground shadow-card">
            Not published yet. Visita's team publishes new listings after a first check.
          </p>
        )}
        <Outlet />
      </div>
    </VenueContext.Provider>
  );
}

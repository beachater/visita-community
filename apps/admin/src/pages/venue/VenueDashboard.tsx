import { useEffect, useState } from "react";
import { Link } from "react-router";
import { supabase } from "@/lib/supabase";
import { OccupancyButtons } from "./OccupancyButtons";
import { useVenue } from "./VenueLayout";

// The Overview tab: occupancy first (it's the thing owners tap daily), then
// what the listing has, then who manages the cafe.

interface Owner {
  id: string;
  role_title: string;
  name: string;
}

export function VenueDashboard() {
  const { venue } = useVenue();
  const [owners, setOwners] = useState<Owner[]>([]);

  useEffect(() => {
    let live = true;
    // Names and roles only: claims (with phone numbers) are private to the claimant and admins.
    supabase.rpc("venue_owner_names", { p_venue_id: venue.id }).then(({ data }) => {
      if (live) setOwners((data ?? []).map((r) => ({ id: r.claim_id, role_title: r.role_title, name: r.display_name ?? "Visita member" })));
    });
    return () => {
      live = false;
    };
  }, [venue.id]);

  const facts = [
    { label: "3D walkthrough", value: venue.splat_url ? "Scanned" : "Not scanned yet" },
    { label: "Menu", value: venue.menu.length ? `${venue.menu.length} items` : "None yet", to: "listing" },
    { label: "Opening hours", value: venue.hours ? "Listed" : "Not listed", to: "listing" },
  ];

  return (
    <div className="grid gap-8">
      <OccupancyButtons venueId={venue.id} />

      <section aria-labelledby="facts-h" className="grid gap-3">
        <h2 id="facts-h" className="text-lg font-semibold">
          Your listing
        </h2>
        <dl className="grid gap-3 sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label} className="rounded-xl border bg-card p-4">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{f.label}</dt>
              <dd className="mt-1 font-medium">
                {f.to ? (
                  <Link to={f.to} className="underline-offset-2 hover:underline">
                    {f.value}
                  </Link>
                ) : (
                  f.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="owners-h" className="grid gap-3">
        <h2 id="owners-h" className="text-lg font-semibold">
          People who manage this cafe
        </h2>
        <ul className="divide-y rounded-xl border bg-card">
          {owners.map((o) => (
            <li key={o.id} className="flex items-center justify-between px-4 py-3">
              <span className="font-medium">{o.name}</span>
              <span className="text-sm text-muted-foreground">{o.role_title}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">Co-owners can join by claiming this cafe with their own Google account.</p>
      </section>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ExternalLink } from "lucide-react";
import { Button } from "@visita/ui/button";
import { CONSUMER_URL, supabase } from "@/lib/supabase";

// An approved owner's home for their venue (PRD 4.4). The listing editor,
// events, occupancy and review replies build on this page.

interface Venue {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  is_published: boolean;
  splat_url: string | null;
  menu: unknown;
  hours: unknown;
}

interface Owner {
  id: string;
  role_title: string;
  name: string;
}

export function VenueDashboard() {
  const { venueId = "" } = useParams();
  const [venue, setVenue] = useState<Venue | null | undefined>(undefined);
  const [owners, setOwners] = useState<Owner[]>([]);

  useEffect(() => {
    let live = true;
    (async () => {
      const [v, o] = await Promise.all([
        supabase.from("venues").select("id, name, slug, address, is_published, splat_url, menu, hours").eq("id", venueId).maybeSingle(),
        supabase
          .from("venue_owners")
          .select("id, role_title, profiles!venue_owners_profile_id_fkey(display_name)")
          .eq("venue_id", venueId)
          .eq("status", "approved"),
      ]);
      if (!live) return;
      setVenue((v.data as Venue | null) ?? null);
      setOwners((o.data ?? []).map((r) => ({ id: r.id, role_title: r.role_title, name: r.profiles?.display_name ?? "Visita member" })));
    })();
    return () => {
      live = false;
    };
  }, [venueId]);

  if (venue === undefined) return <p className="text-muted-foreground">Loading…</p>;
  if (venue === null)
    return (
      <div className="grid gap-3">
        <p>This cafe isn't one you manage.</p>
        <Link to="/" className="underline">
          Go back
        </Link>
      </div>
    );

  const menuItems = Array.isArray(venue.menu) ? venue.menu.length : 0;
  const facts = [
    { label: "3D walkthrough", value: venue.splat_url ? "Scanned" : "Not scanned yet" },
    { label: "Menu", value: menuItems ? `${menuItems} items` : "None yet" },
    { label: "Opening hours", value: venue.hours ? "Listed" : "Not listed" },
  ];

  return (
    <div className="grid gap-8">
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

      <section aria-labelledby="facts-h" className="grid gap-3">
        <h2 id="facts-h" className="text-lg font-semibold">
          Your listing
        </h2>
        <dl className="grid gap-3 sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label} className="rounded-xl border bg-card p-4">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{f.label}</dt>
              <dd className="mt-1 font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted-foreground">Editing your menu, hours, events and busy status arrives in the next update.</p>
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

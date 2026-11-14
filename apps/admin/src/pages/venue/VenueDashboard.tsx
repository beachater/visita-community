import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Check } from "lucide-react";
import { cn } from "@visita/ui/utils";
import { supabase } from "@/lib/supabase";
import { rangeFor, type VenueStats } from "./analytics-data";
import { OccupancyButtons } from "./OccupancyButtons";
import { useVenue } from "./VenueLayout";

// The Overview tab, the owner's home (approved owner workspace, 2026-11-14):
// a greeting and the daily tap (how busy it is), then what's left to do on
// the listing, a glance at this week, and who manages the cafe.

interface Owner {
  id: string;
  role_title: string;
  name: string;
}

function greeting(now: Date): string {
  const hour = Number(new Intl.DateTimeFormat("en-PH", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Manila" }).format(now));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

const card = "rounded-card bg-card p-5 shadow-card sm:p-6";

export function VenueDashboard() {
  const { venue } = useVenue();
  const [owners, setOwners] = useState<Owner[]>([]);
  const [week, setWeek] = useState<VenueStats["totals"] | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    // Names and roles only: claims (with phone numbers) are private to the claimant and admins.
    supabase.rpc("venue_owner_names", { p_venue_id: venue.id }).then(({ data }) => {
      if (live) setOwners((data ?? []).map((r) => ({ id: r.claim_id, role_title: r.role_title, name: r.display_name ?? "Visita member" })));
    });
    const range = rangeFor(7, new Date());
    supabase.rpc("venue_stats", { p_venue_id: venue.id, p_from: range.from, p_to: range.to }).then(({ data, error }) => {
      if (live) setWeek(error ? null : ((data as unknown as VenueStats)?.totals ?? null));
    });
    return () => {
      live = false;
    };
  }, [venue.id]);

  const tasks = [
    { label: "3D walkthrough", done: Boolean(venue.splat_url), doneText: "Scanned", todo: "Not scanned yet", to: null },
    { label: "Opening hours", done: Boolean(venue.hours), doneText: "Listed", todo: "Add your hours", to: "listing" },
    { label: "Menu", done: venue.menu.length > 0, doneText: `${venue.menu.length} items`, todo: "Add your menu", to: "listing" },
  ];
  const done = tasks.filter((t) => t.done).length;
  const stats = [
    { label: "Page views", value: week?.profile_view },
    { label: "Walkthrough opens", value: week?.walkthrough_open },
    { label: "Directions taps", value: week?.directions_tap },
  ];

  return (
    <div className="grid gap-6">
      <header className="grid gap-1.5">
        <p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">Overview</p>
        <h1 className="font-display text-[1.75rem] leading-[1.08] tracking-[-0.025em] sm:text-[2.375rem]">{greeting(new Date())}. How busy is it right now?</h1>
      </header>

      <OccupancyButtons venueId={venue.id} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section aria-labelledby="listing-h" className={cn(card, "grid content-start gap-3")}>
          <div className="flex items-center justify-between gap-3">
            <h2 id="listing-h" className="font-display text-lg">Your listing</h2>
            <span className="text-[0.8rem] font-semibold text-primary">{done} of {tasks.length} done</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-accent" role="progressbar" aria-valuemin={0} aria-valuemax={tasks.length} aria-valuenow={done} aria-label="Listing progress">
            <span className="block h-full rounded-full bg-primary transition-[width]" style={{ width: `${(done / tasks.length) * 100}%` }} />
          </div>
          <ul className="grid divide-y divide-accent">
            {tasks.map((t) => (
              <li key={t.label} className="flex min-h-13 items-center gap-3">
                {t.done ? (
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-success/12 text-success" aria-hidden="true"><Check className="size-3.5" strokeWidth={3} /></span>
                ) : (
                  <span className="size-7 shrink-0 rounded-full border-2 border-dashed border-mist" aria-hidden="true" />
                )}
                <span className="flex-1">{t.label}</span>
                {t.done ? (
                  t.label === "3D walkthrough" ? (
                    <span className="rounded-full bg-verified px-2.5 py-0.5 text-[0.7rem] font-bold text-verified-foreground">{t.doneText}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">{t.doneText}</span>
                  )
                ) : t.to ? (
                  <Link to={t.to} className="text-sm font-semibold text-primary hover:underline">{t.todo}</Link>
                ) : (
                  <span className="text-sm text-muted-foreground">{t.todo}</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="week-h" className={cn(card, "grid content-start gap-3.5")}>
          <div className="flex items-center justify-between gap-3">
            <h2 id="week-h" className="font-display text-lg">This week</h2>
            <Link to="analytics" className="text-sm font-semibold text-primary hover:underline">Analytics</Link>
          </div>
          <dl className="grid grid-cols-3 gap-2.5">
            {stats.map((s) => (
              <div key={s.label} className="grid gap-0.5 rounded-[1.125rem] bg-muted p-3.5">
                <dd className="order-1 font-display text-2xl tabular-nums">{week === undefined ? "…" : s.value ?? "–"}</dd>
                <dt className="order-2 text-xs leading-snug text-muted-foreground">{s.label}</dt>
              </div>
            ))}
          </dl>
          <p className="text-[0.8rem] text-muted-foreground">
            {week === null ? "Couldn't load this week's numbers." : "Counted only for visitors who allowed usage stats."}
          </p>
        </section>
      </div>

      <section aria-labelledby="owners-h" className={cn(card, "grid gap-3")}>
        <h2 id="owners-h" className="font-display text-lg">People who manage this cafe</h2>
        <ul className="grid divide-y divide-accent">
          {owners.map((o) => (
            <li key={o.id} className="flex min-h-12 items-center justify-between gap-3">
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

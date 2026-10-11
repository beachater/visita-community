import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import type { AmenityDefinition, AmenityEntry, VenueAmenities } from "@visita/shared-types";
import { Button } from "@visita/ui/button";
import { Input } from "@visita/ui/input";
import { supabase } from "@/lib/supabase";
import { describeEntry } from "../venue/amenity-form";
import { groupDisputes, type ConfirmRow, type DisputeGroup, type DisputeRow } from "./amenity-reports";

// PRD 4.3/4.5 amenity verification, admin side (Tier 2): visitors who said
// "something's changed" about an amenity. Check the listing (call the cafe,
// or look at the latest scan), fix it if needed, then close every report for
// that amenity at once with admin_resolve_amenity_reports().

const day = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" });
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

interface Venue {
  type: string;
  amenities: VenueAmenities;
}

export function AmenityReports() {
  const [groups, setGroups] = useState<DisputeGroup[] | null>(null);
  const [venues, setVenues] = useState<Record<string, Venue>>({});
  const [defs, setDefs] = useState<Record<string, AmenityDefinition>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    const [reports, definitions] = await Promise.all([
      supabase
        .from("amenity_reports")
        .select("id, venue_id, amenity_key, comment, created_at, venues(name, venue_type, amenities), profiles!amenity_reports_profile_id_fkey(display_name)")
        .eq("status", "open")
        .eq("verdict", "dispute")
        .order("created_at"),
      supabase.from("amenity_definitions").select("*"),
    ]);
    if (reports.error || definitions.error) {
      console.error("[amenity reports]", reports.error ?? definitions.error);
      setError(true);
      return;
    }

    const venueIds = [...new Set(reports.data.map((r) => r.venue_id))];
    let confirms: ConfirmRow[] = [];
    if (venueIds.length) {
      const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
      const c = await supabase
        .from("amenity_reports")
        .select("venue_id, amenity_key, created_at")
        .eq("verdict", "confirm")
        .neq("status", "dismissed")
        .gte("created_at", since)
        .in("venue_id", venueIds);
      if (c.error) console.error("[amenity reports] confirmations", c.error);
      confirms = c.data ?? [];
    }

    const rows: DisputeRow[] = reports.data.map((r) => ({
      id: r.id,
      venue_id: r.venue_id,
      venue_name: r.venues?.name ?? "Unknown venue",
      amenity_key: r.amenity_key,
      comment: r.comment,
      reporter: r.profiles?.display_name ?? "A visitor",
      created_at: r.created_at,
    }));
    setVenues(Object.fromEntries(reports.data.filter((r) => r.venues).map((r) => [r.venue_id, { type: r.venues!.venue_type, amenities: (r.venues!.amenities ?? {}) as VenueAmenities }])));
    setDefs(Object.fromEntries(definitions.data.map((d) => [`${d.venue_type}:${d.key}`, d])));
    setGroups(groupDisputes(rows, confirms));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const total = useMemo(() => groups?.reduce((n, g) => n + g.reports.length, 0) ?? 0, [groups]);

  const close = async (group: DisputeGroup, status: "resolved" | "dismissed") => {
    const key = `${group.venueId}:${group.amenityKey}`;
    setBusy(key);
    const { error } = await supabase.rpc("admin_resolve_amenity_reports", {
      p_venue_id: group.venueId,
      p_amenity_key: group.amenityKey,
      p_status: status,
      p_note: notes[key] ?? "",
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(status === "resolved" ? "Marked fixed" : "Dismissed");
    void load();
  };

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="font-display text-3xl font-bold">Amenity reports</h1>
        <p className="text-muted-foreground">
          {groups && groups.length > 0
            ? `${plural(total, "visitor report", "visitor reports")} across ${plural(groups.length, "amenity", "amenities")}. `
            : "Visitors who said an amenity has changed. "}
          Check with the cafe or the latest scan, update the listing if needed, then close the reports.
        </p>
      </header>

      {error && (
        <div className="grid justify-items-start gap-3 rounded-card bg-card p-5 shadow-card">
          <p role="alert">Couldn't load the reports. Try again, or check that the database is up to date.</p>
          <Button variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      )}
      {!error && groups === null && <p className="text-muted-foreground">Loading…</p>}
      {groups?.length === 0 && (
        <p className="rounded-card border border-dashed border-mist bg-card/70 p-8 text-center text-muted-foreground">No open reports. Every listing checks out.</p>
      )}

      <ul className="grid gap-3">
        {groups?.map((g) => {
          const key = `${g.venueId}:${g.amenityKey}`;
          const venue = venues[g.venueId];
          const def = venue ? defs[`${venue.type}:${g.amenityKey}`] : undefined;
          const label = def?.label ?? g.amenityKey;
          const current = venue?.amenities[g.amenityKey] as AmenityEntry | undefined;
          return (
            <li key={key} className="grid gap-4 rounded-card bg-card p-5 shadow-card">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-medium">
                  {g.venueName} · {label}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {plural(g.reports.length, "report", "reports")} · {g.reports.length > 1 ? `${day(g.firstAt)} – ${day(g.lastAt)}` : day(g.lastAt)}
                </p>
              </div>

              <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Listing says</dt>
                <dd className="font-medium">{def ? describeEntry(def, current) : JSON.stringify(current ?? null)}</dd>
                {g.confirmsSince > 0 && (
                  <>
                    <dt className="text-muted-foreground">Since then</dt>
                    <dd>{plural(g.confirmsSince, "visitor said it's still right", "visitors said it's still right")}</dd>
                  </>
                )}
              </dl>

              <ul className="grid gap-2 border-l-2 border-mist pl-4 text-sm">
                {g.reports.map((r) => (
                  <li key={r.id} className="grid gap-0.5">
                    <span>{r.comment ? `“${r.comment}”` : <span className="text-muted-foreground">No note</span>}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.reporter}, {day(r.created_at)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label={`Note about ${label} at ${g.venueName}`}
                  placeholder="What you found (optional, admins only)"
                  maxLength={500}
                  value={notes[key] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [key]: e.target.value }))}
                  className="min-w-64 flex-1"
                />
                <Button asChild variant="outline">
                  <Link to={`/admin/venues/${g.venueId}`}>Edit listing</Link>
                </Button>
                <Button disabled={busy === key} onClick={() => void close(g, "resolved")}>
                  Mark fixed
                </Button>
                <Button variant="outline" disabled={busy === key} onClick={() => void close(g, "dismissed")}>
                  Dismiss
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

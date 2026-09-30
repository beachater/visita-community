import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { AmenityDefinition, AmenityEntry, VenueAmenities } from "@visita/shared-types";
import { Button } from "@visita/ui/button";
import { Input } from "@visita/ui/input";
import { supabase } from "@/lib/supabase";
import { describeEntry } from "../venue/amenity-form";

// PRD 4.5 amenity edit queue: owners' requested changes to verified
// amenities. Approving writes the change to the listing through
// review_amenity_change(), which the database validates again.

interface Item {
  id: string;
  venueName: string;
  amenityKey: string;
  entry: AmenityEntry | null;
  current: AmenityEntry | undefined;
  requestedBy: string;
  createdAt: string;
}

export function AmenityQueue() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [defs, setDefs] = useState<Record<string, AmenityDefinition>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [q, d] = await Promise.all([
      supabase
        .from("amenity_change_requests")
        .select("id, amenity_key, entry, created_at, venues(name, amenities), profiles!amenity_change_requests_requested_by_fkey(display_name)")
        .eq("status", "pending")
        .order("created_at"),
      supabase.from("amenity_definitions").select("*").eq("venue_type", "cafe"),
    ]);
    setDefs(Object.fromEntries((d.data ?? []).map((x) => [x.key, x])));
    setItems(
      (q.data ?? []).map((r) => ({
        id: r.id,
        venueName: r.venues?.name ?? "Unknown venue",
        amenityKey: r.amenity_key,
        entry: r.entry as AmenityEntry | null,
        current: ((r.venues?.amenities ?? {}) as VenueAmenities)[r.amenity_key],
        requestedBy: r.profiles?.display_name ?? "An owner",
        createdAt: r.created_at,
      })),
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (item: Item, decision: "approved" | "rejected") => {
    const note = notes[item.id] ?? "";
    if (decision === "rejected" && !note.trim()) return toast.error("Say why, so the owner knows.");
    const { error } = await supabase.rpc("review_amenity_change", { p_request_id: item.id, p_decision: decision, p_note: note });
    if (error) return toast.error(error.message);
    toast.success(decision === "approved" ? "Approved and applied to the listing" : "Rejected");
    void load();
  };

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Amenity changes</h1>
        <p className="text-muted-foreground">Owners' requested changes to verified amenities, oldest first. Check against the latest scan before approving.</p>
      </header>
      {items === null && <p className="text-muted-foreground">Loading…</p>}
      {items?.length === 0 && <p className="rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground">No changes waiting.</p>}
      <ul className="grid gap-3">
        {items?.map((item) => {
          const def = defs[item.amenityKey];
          const label = def?.label ?? item.amenityKey;
          const fmt = (e: AmenityEntry | null | undefined) => (def ? describeEntry(def, e) : JSON.stringify(e));
          return (
            <li key={item.id} className="grid gap-3 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">
                  {item.venueName} · {label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.requestedBy}, {new Date(item.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Now</dt>
                <dd>{fmt(item.current)}</dd>
                <dt className="text-muted-foreground">Requested</dt>
                <dd className="font-medium">{item.entry ? fmt(item.entry) : "Remove from the listing"}</dd>
              </dl>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label={`Note about ${label} for ${item.venueName}`}
                  placeholder="Note to the owner (required to reject)"
                  value={notes[item.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [item.id]: e.target.value }))}
                  className="min-w-64 flex-1"
                />
                <Button onClick={() => void decide(item, "approved")}>Approve</Button>
                <Button variant="outline" onClick={() => void decide(item, "rejected")}>
                  Reject
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

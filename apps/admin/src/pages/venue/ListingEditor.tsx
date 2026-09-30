import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import type { AmenityDefinition, AmenityEntry, Json } from "@visita/shared-types";
import { Button } from "@visita/ui/button";
import { Input } from "@visita/ui/input";
import { Label } from "@visita/ui/label";
import { supabase } from "@/lib/supabase";
import { describeEntry, toEntry } from "./amenity-form";
import { HoursEditor } from "./HoursEditor";
import { MenuEditor } from "./MenuEditor";
import { useVenue } from "./VenueLayout";

// The Listing tab (PRD 4.4). Menu and hours save straight away. Amenities are
// verified by Visita's scans, so changes are requested and show "Pending
// review" until an admin confirms them.

interface Request {
  id: string;
  amenity_key: string;
  entry: AmenityEntry | null;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
}

function AmenityRow({ def, current, pending, onRequested }: { def: AmenityDefinition; current: AmenityEntry | undefined; pending: Request | undefined; onRequested: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { venue } = useVenue();

  const submit = async (remove = false) => {
    const entry = remove ? null : toEntry(def, value, label);
    if (entry === "invalid") {
      setError("Enter a number.");
      return;
    }
    if (!remove && entry === null) {
      setError("Enter a value, a description, or both.");
      return;
    }
    const { error: e } = await supabase.from("amenity_change_requests").insert({ venue_id: venue.id, amenity_key: def.key, entry: entry as Json | null });
    if (e) {
      setError(e.code === "23505" ? "There's already a change waiting for review." : "Couldn't send the request. Try again.");
      return;
    }
    setEditing(false);
    setError(null);
    toast.success(`${def.label}: sent for review`);
    onRequested();
  };

  const withdraw = async () => {
    if (!pending) return;
    await supabase.from("amenity_change_requests").delete().eq("id", pending.id);
    onRequested();
  };

  return (
    <li className="grid gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{def.label}</p>
          <p className="text-sm text-muted-foreground">{describeEntry(def, current)}</p>
        </div>
        {pending ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-warning/50 px-2.5 py-1 text-xs font-medium">
              <Clock className="size-3.5" aria-hidden="true" /> Pending review: {pending.entry ? describeEntry(def, pending.entry) : "remove"}
            </span>
            <Button variant="ghost" size="sm" onClick={() => void withdraw()}>
              Withdraw
            </Button>
          </div>
        ) : (
          !editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Request a change
            </Button>
          )
        )}
      </div>
      {editing && (
        <div className="grid gap-3 rounded-lg bg-muted p-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor={`v-${def.key}`}>{def.value_type === "list" ? "Values (comma-separated)" : "Value"}</Label>
            {def.value_type === "boolean" ? (
              <select id={`v-${def.key}`} value={value} onChange={(e) => setValue(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                <option value="">Choose…</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            ) : (
              <Input id={`v-${def.key}`} value={value} onChange={(e) => setValue(e.target.value)} inputMode={def.value_type === "number" ? "numeric" : undefined} />
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`l-${def.key}`}>How it reads on your listing (optional)</Label>
            <Input id={`l-${def.key}`} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. 7 inside, 2 outside" />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive sm:col-span-2">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button size="sm" onClick={() => void submit()}>
              Send for review
            </Button>
            {current && (
              <Button size="sm" variant="outline" onClick={() => void submit(true)}>
                Ask to remove
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function AmenityRequests() {
  const { venue } = useVenue();
  const [defs, setDefs] = useState<AmenityDefinition[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);

  const load = useCallback(async () => {
    const [d, r] = await Promise.all([
      supabase.from("amenity_definitions").select("*").eq("venue_type", venue.venue_type).eq("is_active", true).order("sort_order"),
      supabase
        .from("amenity_change_requests")
        .select("id, amenity_key, entry, status, review_note, created_at")
        .eq("venue_id", venue.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setDefs(d.data ?? []);
    setRequests((r.data ?? []) as Request[]);
  }, [venue.id, venue.venue_type]);

  useEffect(() => {
    void load();
  }, [load]);

  const decided = requests.filter((r) => r.status !== "pending").slice(0, 5);
  return (
    <section aria-labelledby="amen-h" className="grid gap-3">
      <div>
        <h2 id="amen-h" className="text-lg font-semibold">
          Amenities
        </h2>
        <p className="text-sm text-muted-foreground">Visita verifies amenities, so changes go to our team first. Your listing keeps the current details until a change is approved.</p>
      </div>
      <ul className="divide-y rounded-xl border bg-card">
        {defs.map((def) => (
          <AmenityRow
            key={def.key}
            def={def}
            current={venue.amenities[def.key]}
            pending={requests.find((r) => r.amenity_key === def.key && r.status === "pending")}
            onRequested={() => void load()}
          />
        ))}
      </ul>
      {decided.length > 0 && (
        <div className="grid gap-1 text-sm">
          <p className="font-medium">Recent decisions</p>
          {decided.map((r) => (
            <p key={r.id} className="text-muted-foreground">
              {defs.find((d) => d.key === r.amenity_key)?.label ?? r.amenity_key}: {r.status === "approved" ? "approved" : "not approved"}
              {r.review_note ? ` (${r.review_note})` : ""}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

export function ListingEditor() {
  return (
    <div className="grid gap-10">
      <MenuEditor />
      <HoursEditor />
      <AmenityRequests />
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { AmenityDefinition, Json, VenueAmenities } from "@visita/shared-types";
import { Button } from "@visita/ui/button";
import { Input } from "@visita/ui/input";
import { Label } from "@visita/ui/label";
import { Switch } from "@visita/ui/switch";
import { CONSUMER_URL, supabase } from "@/lib/supabase";
import { describeEntry, toEntry } from "../venue/amenity-form";
import { ScanUpload } from "./ScanUpload";
import { slugify, toVenueRow, type VenueFormState } from "./venue-form";

// PRD 4.5: create and edit any venue. Admins edit amenities directly (the
// owners' request queue is for owners); menu and hours use the same editor
// owners have.

const EMPTY: VenueFormState = {
  name: "",
  slug: "",
  address: "",
  city: "Cagayan de Oro",
  lat: "",
  lng: "",
  googlePlaceId: "",
  searchTerms: "",
  isTopPick: false,
  isPublished: false,
};

export interface AdminVenue {
  id: string;
  slug: string;
  venue_type: "cafe";
  amenities: VenueAmenities;
  splat_url: string | null;
  splat_preview_url: string | null;
  scanned_at: string | null;
  is_published: boolean;
}

function AmenityEditor({ venue, onSaved }: { venue: AdminVenue; onSaved: () => void }) {
  const [defs, setDefs] = useState<AmenityDefinition[]>([]);
  const [draft, setDraft] = useState<Record<string, { value: string; label: string }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("amenity_definitions")
      .select("*")
      .eq("venue_type", venue.venue_type)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setDefs(data ?? []));
  }, [venue.venue_type]);

  useEffect(() => {
    const d: Record<string, { value: string; label: string }> = {};
    for (const [key, e] of Object.entries(venue.amenities)) {
      const v = e.value;
      d[key] = { value: typeof v === "boolean" ? (v ? "yes" : "no") : Array.isArray(v) ? v.join(", ") : v === undefined ? "" : String(v), label: e.label ?? "" };
    }
    setDraft(d);
  }, [venue.amenities]);

  const save = async () => {
    const next: VenueAmenities = {};
    for (const def of defs) {
      const d = draft[def.key];
      if (!d) continue;
      const entry = toEntry(def, d.value, d.label);
      if (entry === "invalid") return toast.error(`${def.label}: enter a number.`);
      if (entry) next[def.key] = entry;
    }
    setSaving(true);
    const { error } = await supabase.from("venues").update({ amenities: next as unknown as Json }).eq("id", venue.id);
    setSaving(false);
    if (error) return toast.error(`Couldn't save amenities: ${error.message}`);
    toast.success("Amenities saved");
    onSaved();
  };

  return (
    <section aria-labelledby="amen-h" className="grid gap-3 rounded-card border bg-card shadow-card p-5">
      <div>
        <h2 id="amen-h" className="text-lg font-semibold">
          Amenities
        </h2>
        <p className="text-sm text-muted-foreground">Leave both fields empty to leave an amenity off the listing. "Shown as" is optional wording.</p>
      </div>
      <div className="grid gap-3">
        {defs.map((def) => {
          const d = draft[def.key] ?? { value: "", label: "" };
          const set = (patch: Partial<typeof d>) => setDraft((all) => ({ ...all, [def.key]: { ...d, ...patch } }));
          return (
            <div key={def.key} className="grid items-center gap-2 sm:grid-cols-[9rem_1fr_1fr]">
              <span className="text-sm font-medium">
                {def.label}
                {def.unit ? ` (${def.unit})` : ""}
              </span>
              {def.value_type === "boolean" ? (
                <select aria-label={`${def.label} value`} value={d.value} onChange={(e) => set({ value: e.target.value })} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm">
                  <option value="">Not listed</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : (
                <Input aria-label={`${def.label} value`} value={d.value} onChange={(e) => set({ value: e.target.value })} placeholder={def.value_type === "list" ? "Comma-separated" : def.value_type} />
              )}
              <Input aria-label={`${def.label} shown as`} value={d.label} onChange={(e) => set({ label: e.target.value })} placeholder={`Shown as (${describeEntry(def, undefined)})`} />
            </div>
          );
        })}
      </div>
      <div>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save amenities"}
        </Button>
      </div>
    </section>
  );
}

export function VenueForm() {
  const { venueId } = useParams();
  const isNew = !venueId;
  const navigate = useNavigate();
  const [form, setForm] = useState<VenueFormState>(EMPTY);
  const [venue, setVenue] = useState<AdminVenue | null>(null);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [error, setError] = useState<{ field: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!venueId) return;
    const { data } = await supabase
      .from("venues")
      .select("id, slug, venue_type, name, address, city, lat, lng, google_place_id, search_terms, is_top_pick, is_published, amenities, splat_url, splat_preview_url, scanned_at")
      .eq("id", venueId)
      .maybeSingle();
    if (!data) return;
    setVenue({ ...data, venue_type: "cafe", amenities: (data.amenities as VenueAmenities) ?? {} });
    setForm({
      name: data.name,
      slug: data.slug,
      address: data.address ?? "",
      city: data.city,
      lat: data.lat?.toString() ?? "",
      lng: data.lng?.toString() ?? "",
      googlePlaceId: data.google_place_id ?? "",
      searchTerms: (data.search_terms ?? []).join(", "),
      isTopPick: data.is_top_pick,
      isPublished: data.is_published,
    });
  }, [venueId]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = (patch: Partial<VenueFormState>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    const result = toVenueRow(form);
    if (!result.ok) return setError({ field: result.field, message: result.error });
    setError(null);
    setSaving(true);
    const res = isNew
      ? await supabase.from("venues").insert(result.row).select("id").single()
      : await supabase.from("venues").update(result.row).eq("id", venueId!).select("id").single();
    setSaving(false);
    if (res.error) {
      setError({ field: res.error.code === "23505" ? "slug" : "", message: res.error.code === "23505" ? "That slug or Google Place ID is already used by another venue." : res.error.message });
      return;
    }
    toast.success(isNew ? "Venue created" : "Saved");
    if (isNew) navigate(`/admin/venues/${res.data.id}`, { replace: true });
    else void load();
  };

  const field = (key: keyof VenueFormState, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`f-${key}`}>{label}</Label>
      <Input
        id={`f-${key}`}
        value={form[key] as string}
        aria-invalid={error?.field === key}
        onChange={(e) => {
          const value = e.target.value;
          if (key === "name" && !slugTouched) set({ name: value, slug: slugify(value) });
          else {
            if (key === "slug") setSlugTouched(true);
            set({ [key]: value } as Partial<VenueFormState>);
          }
        }}
        {...props}
      />
    </div>
  );

  return (
    <div className="grid max-w-3xl gap-6">
      <Link to="/admin/venues" className="inline-flex w-fit items-center gap-1 text-sm underline-offset-2 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" /> All venues
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">{isNew ? "New venue" : form.name || "Venue"}</h1>
        {!isNew && venue?.is_published && (
          <Button asChild variant="outline">
            <a href={`${CONSUMER_URL}/cafe/${venue.slug}`} target="_blank" rel="noopener">
              <ExternalLink /> View on Visita
            </a>
          </Button>
        )}
      </header>

      <section aria-label="Details" className="grid gap-4 rounded-card border bg-card shadow-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {field("name", "Name")}
          {field("slug", "Slug (the /cafe/… address)")}
          {field("address", "Address")}
          {field("city", "City")}
          {field("lat", "Latitude", { inputMode: "decimal", placeholder: "8.4822" })}
          {field("lng", "Longitude", { inputMode: "decimal", placeholder: "124.6465" })}
          {field("googlePlaceId", "Google Place ID (optional)")}
          {field("searchTerms", "Extra search terms (comma-separated)", { placeholder: "sonnys, sonny's diner" })}
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.isPublished} onCheckedChange={(c) => set({ isPublished: c })} aria-label="Published" /> Published (visible on Visita)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.isTopPick} onCheckedChange={(c) => set({ isTopPick: c })} aria-label="Top pick" /> Top pick
          </label>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error.message}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : isNew ? "Create venue" : "Save details"}
          </Button>
          {!isNew && (
            <Button asChild variant="outline">
              <Link to={`/venue/${venueId}/listing`}>Edit menu and hours</Link>
            </Button>
          )}
        </div>
      </section>

      {venue && (
        <>
          <ScanUpload venue={venue} onDone={() => void load()} />
          <AmenityEditor venue={venue} onSaved={() => void load()} />
        </>
      )}
    </div>
  );
}

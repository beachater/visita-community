import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Plus } from "lucide-react";
import type { AmenityDefinition } from "@visita/shared-types";
import { AMENITY_ICONS, amenityIcon } from "@visita/ui/amenity-icon";
import { Button } from "@visita/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@visita/ui/dialog";
import { Input } from "@visita/ui/input";
import { Label } from "@visita/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@visita/ui/select";
import { Switch } from "@visita/ui/switch";
import { cn } from "@visita/ui/utils";
import { supabase } from "@/lib/supabase";
import { canFilter, keyFromLabel, newAmenityError, nextSortOrder, VALUE_TYPES, type NewAmenity, type ValueType } from "./amenity-catalog";

// Amenities & filters: the cafe amenity catalog (amenity_definitions). Each
// row is a fact a cafe can list (Wi-Fi, outlets, parking…). Turning on
// "Map filter" offers it as a filter on the visitor site; no deploy needed.
// Amenities are never deleted, since cafes store values under their key;
// turning one off hides it everywhere and keeps the values.

type Def = AmenityDefinition;
const VENUE_TYPE = "cafe" as const;
const COLUMNS = "venue_type, key, label, icon, value_type, unit, is_filterable, summary_rank, sort_order, requires_verification, is_active, created_at, updated_at";
const typeLabel = (t: ValueType) => VALUE_TYPES.find((v) => v.value === t)?.label ?? t;

const EMPTY: NewAmenity = { label: "", key: "", valueType: "boolean", unit: "", icon: "", filterable: false };

export function AmenityCatalog() {
  const [defs, setDefs] = useState<Def[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Def | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase.from("amenity_definitions").select(COLUMNS).eq("venue_type", VENUE_TYPE).order("sort_order");
    if (error || !data) {
      if (error) console.error("[amenity-catalog]", error);
      return setError("Couldn't load the amenities. Try again.");
    }
    setDefs(data as Def[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** One field on one row. `.select()` so a write RLS refused shows as an error. */
  const update = async (def: Def, patch: Partial<Def>, done: string) => {
    setBusy(def.key);
    const { data, error } = await supabase.from("amenity_definitions").update(patch).eq("venue_type", VENUE_TYPE).eq("key", def.key).select(COLUMNS).maybeSingle();
    setBusy(null);
    if (error || !data) {
      if (error) console.error("[amenity-catalog]", error);
      toast.error("Couldn't save. Only admins can change amenities.");
      return false;
    }
    setDefs((list) => list?.map((d) => (d.key === def.key ? (data as Def) : d)) ?? null);
    toast.success(done);
    return true;
  };

  /** Swap a row's position with its neighbour. */
  const move = async (index: number, dir: -1 | 1) => {
    if (!defs) return;
    const a = defs[index];
    const b = defs[index + dir];
    if (!a || !b) return;
    setBusy(a.key);
    const [r1, r2] = await Promise.all([
      supabase.from("amenity_definitions").update({ sort_order: b.sort_order }).eq("venue_type", VENUE_TYPE).eq("key", a.key),
      supabase.from("amenity_definitions").update({ sort_order: a.sort_order }).eq("venue_type", VENUE_TYPE).eq("key", b.key),
    ]);
    setBusy(null);
    if (r1.error || r2.error) toast.error("Couldn't reorder. Try again.");
    await load();
  };

  return (
    <div className="grid max-w-5xl gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="font-display text-3xl font-bold">Amenities &amp; filters</h1>
          <p className="max-w-2xl text-muted-foreground">
            The facts a cafe can list, in the order they show. Turn on <b className="font-semibold text-foreground">Map filter</b> to offer one as a filter on the
            visitor site. Changes apply on the next page load, no deploy needed.
          </p>
        </div>
        <Button className="rounded-full" onClick={() => setAdding(true)}>
          <Plus /> Add amenity
        </Button>
      </header>

      {error && (
        <div className="grid justify-items-start gap-3">
          <p role="alert">{error}</p>
          <Button variant="outline" onClick={() => void load()}>Try again</Button>
        </div>
      )}
      {!defs && !error && <p className="text-muted-foreground">Loading…</p>}

      {defs && (
        <section aria-label="Amenities" className="overflow-hidden rounded-card bg-card shadow-card">
          <div className="hidden grid-cols-[4.5rem_minmax(0,1fr)_7rem_7rem_7rem_7rem_3rem] items-center gap-3 border-b px-5 py-3 text-xs font-bold tracking-wider text-muted-foreground uppercase md:grid">
            <span>Order</span>
            <span>Amenity</span>
            <span>Type</span>
            <span>Map filter</span>
            <span>Owner edits</span>
            <span>Shown</span>
            <span className="sr-only">Edit</span>
          </div>
          <ul className="divide-y">
            {defs.map((d, i) => {
              const Icon = amenityIcon(d.icon);
              const disabled = busy === d.key;
              return (
                <li key={d.key} className={cn("grid items-center gap-3 px-5 py-3.5 md:grid-cols-[4.5rem_minmax(0,1fr)_7rem_7rem_7rem_7rem_3rem]", !d.is_active && "opacity-60")}>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label={`Move ${d.label} up`} disabled={i === 0 || disabled} onClick={() => void move(i, -1)}><ArrowUp /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Move ${d.label} down`} disabled={i === defs.length - 1 || disabled} onClick={() => void move(i, 1)}><ArrowDown /></Button>
                  </div>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-primary" aria-hidden="true"><Icon className="size-4.5" /></span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{d.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        <code>{d.key}</code>
                        {d.unit && ` · unit “${d.unit}”`}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm">{typeLabel(d.value_type)}</span>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={d.is_filterable}
                      disabled={disabled || !canFilter(d.value_type) || !d.is_active}
                      onCheckedChange={(on) => void update(d, { is_filterable: on }, on ? `${d.label} is now a map filter` : `${d.label} removed from filters`)}
                      aria-label={`${d.label} as a map filter`}
                    />
                    <span className="md:sr-only">{canFilter(d.value_type) ? "Map filter" : "Not filterable"}</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm" title="On: an owner's change waits for admin approval. Off: it goes live right away.">
                    <Switch
                      checked={d.requires_verification}
                      disabled={disabled}
                      onCheckedChange={(on) => void update(d, { requires_verification: on }, on ? `Owner edits to ${d.label} now need approval` : `Owner edits to ${d.label} now go live directly`)}
                      aria-label={`Owner edits to ${d.label} need approval`}
                    />
                    <span className="text-xs text-muted-foreground">{d.requires_verification ? "Need approval" : "Go live"}</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={d.is_active}
                      disabled={disabled}
                      onCheckedChange={(on) => void update(d, on ? { is_active: true } : { is_active: false, is_filterable: false }, on ? `${d.label} is shown again` : `${d.label} hidden. Cafes keep their values.`)}
                      aria-label={`Show ${d.label}`}
                    />
                    <span className="md:sr-only">Shown</span>
                  </label>
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${d.label}`} onClick={() => setEditing(d)}><Pencil /></Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {defs && (
        <p className="max-w-3xl text-sm text-muted-foreground">
          Price and “Open 24/7” are always offered as filters; they come from the menu and the hours. Only yes/no and number amenities can be filters. Hiding an
          amenity also removes it from filters; cafes keep what they listed, so showing it again loses nothing.
        </p>
      )}

      {defs && <AddDialog open={adding} onOpenChange={setAdding} existing={defs} onAdded={(d) => setDefs((list) => [...(list ?? []), d])} />}
      {editing && <EditDialog def={editing} onClose={() => setEditing(null)} onSave={(patch) => update(editing, patch, "Saved")} />}
    </div>
  );
}

function IconPicker({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? "" : v)}>
      <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No icon (check mark)</SelectItem>
        {Object.entries(AMENITY_ICONS).map(([name, { icon: Icon, label }]) => (
          <SelectItem key={name} value={name}>
            <Icon className="size-4" aria-hidden="true" /> {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AddDialog({ open, onOpenChange, existing, onAdded }: { open: boolean; onOpenChange: (o: boolean) => void; existing: Def[]; onAdded: (d: Def) => void }) {
  const [form, setForm] = useState<NewAmenity>(EMPTY);
  const [keyTouched, setKeyTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const set = (patch: Partial<NewAmenity>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (open) { setForm(EMPTY); setKeyTouched(false); setProblem(null); }
  }, [open]);

  const save = async () => {
    const err = newAmenityError(form, existing);
    if (err) return setProblem(err);
    setSaving(true);
    const { data, error } = await supabase
      .from("amenity_definitions")
      .insert({
        venue_type: VENUE_TYPE,
        key: form.key,
        label: form.label.trim(),
        icon: form.icon || null,
        value_type: form.valueType,
        unit: form.valueType === "number" && form.unit.trim() ? form.unit.trim() : null,
        is_filterable: form.filterable && canFilter(form.valueType),
        sort_order: nextSortOrder(existing),
      })
      .select(COLUMNS)
      .single();
    setSaving(false);
    if (error || !data) {
      if (error) console.error("[amenity-catalog]", error);
      return setProblem(error?.code === "23505" ? "That key is already taken." : "Couldn't add it. Only admins can add amenities.");
    }
    onAdded(data as Def);
    toast.success(`${form.label.trim()} added. Cafes can now list it.`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add an amenity</DialogTitle>
          <DialogDescription>Something cafes can list, like “Pet friendly” or “Smoking area”. Owners and admins can then fill it in for each cafe.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="amenity-label">Name</Label>
            <Input id="amenity-label" value={form.label} onChange={(e) => set({ label: e.target.value, ...(keyTouched ? {} : { key: keyFromLabel(e.target.value) }) })} placeholder="Pet friendly" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="amenity-key">Key</Label>
            <Input id="amenity-key" value={form.key} onChange={(e) => { setKeyTouched(true); set({ key: e.target.value }); }} className="font-mono" />
            <p className="text-xs text-muted-foreground">Stored on every cafe. It can't be changed later.</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="amenity-type">Type</Label>
            <Select value={form.valueType} onValueChange={(v) => set({ valueType: v as ValueType, filterable: form.filterable && canFilter(v as ValueType) })}>
              <SelectTrigger id="amenity-type" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VALUE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{VALUE_TYPES.find((t) => t.value === form.valueType)?.hint} Can't be changed later.</p>
          </div>
          {form.valueType === "number" && (
            <div className="grid gap-1.5">
              <Label htmlFor="amenity-unit">Unit (optional)</Label>
              <Input id="amenity-unit" value={form.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="seats" />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="amenity-icon">Icon</Label>
            <IconPicker id="amenity-icon" value={form.icon} onChange={(icon) => set({ icon })} />
          </div>
          <label className="flex items-center justify-between gap-4">
            <span className="grid gap-0.5">
              <span className="text-sm font-medium">Offer as a map filter</span>
              <span className="text-xs text-muted-foreground">{canFilter(form.valueType) ? "Visitors can filter cafes by it." : "Only yes/no and number amenities can be filters."}</span>
            </span>
            <Switch checked={form.filterable} disabled={!canFilter(form.valueType)} onCheckedChange={(on) => set({ filterable: on })} />
          </label>
          {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? "Adding…" : "Add amenity"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ def, onClose, onSave }: { def: Def; onClose: () => void; onSave: (patch: Partial<Def>) => Promise<boolean> }) {
  const [label, setLabel] = useState(def.label);
  const [icon, setIcon] = useState(def.icon ?? "");
  const [unit, setUnit] = useState(def.unit ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!label.trim()) return;
    setSaving(true);
    const ok = await onSave({ label: label.trim(), icon: icon || null, unit: def.value_type === "number" ? unit.trim() || null : def.unit });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {def.label}</DialogTitle>
          <DialogDescription>
            Key <code>{def.key}</code> · {typeLabel(def.value_type)}. The key and type can't change, because cafes store values under them.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="edit-label">Name</Label>
            <Input id="edit-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          {def.value_type === "number" && (
            <div className="grid gap-1.5">
              <Label htmlFor="edit-unit">Unit (optional)</Label>
              <Input id="edit-unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="edit-icon">Icon</Label>
            <IconPicker id="edit-icon" value={icon} onChange={setIcon} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving || !label.trim()}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

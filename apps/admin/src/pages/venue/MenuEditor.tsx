import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Camera, Plus, Trash2 } from "lucide-react";
import type { Json } from "@visita/shared-types";
import { Button } from "@visita/ui/button";
import { Input } from "@visita/ui/input";
import { supabase } from "@/lib/supabase";
import { scanMenuPhoto } from "@/lib/api";
import { mergeScan } from "@/lib/menu-scan";
import { menuFromRows, rowsFromMenu, type MenuRow } from "./menu-form";
import { useVenue } from "./VenueLayout";

// PRD 4.4: owners edit menu items, prices and sections directly.
const EMPTY: MenuRow = { name: "", price: "", section: "", note: "" };

export function MenuEditor() {
  const { venue, reload } = useVenue();
  const [rows, setRows] = useState<MenuRow[]>(() => (venue.menu.length ? rowsFromMenu(venue.menu) : [{ ...EMPTY }]));
  const [error, setError] = useState<{ row: number; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [beforeScan, setBeforeScan] = useState<{ rows: MenuRow[]; dirty: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photo) { setPhotoUrl(null); return; }
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const update = (i: number, patch: Partial<MenuRow>) => {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setDirty(true);
    setBeforeScan(null);
  };
  const move = (i: number, by: -1 | 1) => {
    setRows((rs) => {
      const next = [...rs];
      const [item] = next.splice(i, 1);
      next.splice(i + by, 0, item!);
      return next;
    });
    setDirty(true);
    setBeforeScan(null);
  };

  const readPhoto = async () => {
    if (!photo || scanning || saving) return;
    setScanError(null);
    setScanResult(null);
    setScanning(true);
    try {
      const scanned = await scanMenuPhoto(venue.id, photo);
      const merged = mergeScan(rows, scanned);
      if (merged.added || merged.updated) {
        setBeforeScan({ rows: rows.map((row) => ({ ...row })), dirty });
        setRows(merged.rows);
        setDirty(true);
      }
      setScanResult(
        merged.added || merged.updated
          ? `${merged.added} added, ${merged.updated} updated. Review the menu below, then select Save menu.`
          : "No new or changed items found. Your menu is unchanged.",
      );
      setPhoto(null);
    } catch (cause) {
      setScanError(cause instanceof Error ? cause.message : "Couldn't read the menu photo. Try again.");
    } finally {
      setScanning(false);
    }
  };

  const save = async () => {
    const result = menuFromRows(rows);
    if (!result.ok) {
      setError({ row: result.row, message: result.error });
      return;
    }
    setError(null);
    setSaving(true);
    const { error: rpcError } = await supabase.rpc("owner_update_listing", { p_venue_id: venue.id, p_patch: { menu: result.menu } as unknown as Json });
    setSaving(false);
    if (rpcError) {
      toast.error("Couldn't save the menu. Try again.");
      return;
    }
    setDirty(false);
    setBeforeScan(null);
    setScanResult(null);
    toast.success(`Menu saved (${result.menu.length} ${result.menu.length === 1 ? "item" : "items"})`);
    await reload();
  };

  return (
    <section aria-labelledby="menu-h" className="grid gap-3">
      <div>
        <h2 id="menu-h" className="text-lg font-semibold">
          Menu
        </h2>
        <p className="text-sm text-muted-foreground">Prices are in pesos. Leave a price blank if it varies. Sections group items, like "Coffee" or "Pastries".</p>
      </div>
      <div className="grid gap-3 rounded-card border bg-card p-4 sm:p-5">
        <div>
          <h3 className="font-semibold">Add items from a photo</h3>
          <p className="text-sm text-muted-foreground">Take or choose a clear photo of one menu page. Check names and prices before you save. The photo is used to read the menu and is not saved to the listing.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="min-h-11" disabled={scanning || saving} onClick={() => fileRef.current?.click()}>
            <Camera /> {photo ? "Choose another photo" : "Choose menu photo"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              setPhoto(event.target.files?.[0] ?? null);
              setScanError(null);
              setScanResult(null);
              event.target.value = "";
            }}
          />
          {photo && <Button className="min-h-11" disabled={scanning || saving} onClick={() => void readPhoto()}>{scanning ? "Reading menu…" : "Read menu"}</Button>}
          {photo && !scanning && <Button variant="ghost" className="min-h-11" onClick={() => setPhoto(null)}>Remove photo</Button>}
        </div>
        {photoUrl && <img src={photoUrl} alt="Selected menu photo preview" className="max-h-52 max-w-full rounded-lg border object-contain" />}
        {scanning && <p role="status" className="text-sm text-muted-foreground">Reading the photo. This may take a moment.</p>}
        {scanError && <p role="alert" className="text-sm text-destructive">{scanError}</p>}
        {scanResult && <p role="status" className="text-sm font-medium">{scanResult}</p>}
        {beforeScan && (
          <Button variant="ghost" className="min-h-11 w-fit" onClick={() => { setRows(beforeScan.rows); setDirty(beforeScan.dirty); setBeforeScan(null); setScanResult(null); }}>
            Undo photo changes
          </Button>
        )}
      </div>
      <div className="grid gap-2">
        <div className="hidden grid-cols-[1fr_6rem_9rem_1fr_6.5rem] gap-2 px-1 text-xs font-medium text-muted-foreground md:grid">
          <span>Item</span>
          <span>Price (₱)</span>
          <span>Section</span>
          <span>Note</span>
          <span className="sr-only">Actions</span>
        </div>
        {rows.map((r, i) => (
          <div key={i} className={`grid gap-2 rounded-lg p-1 md:grid-cols-[1fr_6rem_9rem_1fr_6.5rem] ${error?.row === i ? "bg-destructive/10" : ""}`}>
            <Input aria-label={`Item ${i + 1} name`} placeholder="Latte" value={r.name} disabled={scanning || saving} onChange={(e) => update(i, { name: e.target.value })} />
            <Input aria-label={`Item ${i + 1} price`} inputMode="decimal" placeholder="140" value={r.price} disabled={scanning || saving} onChange={(e) => update(i, { price: e.target.value })} />
            <Input aria-label={`Item ${i + 1} section`} placeholder="Coffee" value={r.section} disabled={scanning || saving} onChange={(e) => update(i, { section: e.target.value })} list="menu-sections" />
            <Input aria-label={`Item ${i + 1} note`} placeholder="Iced +₱20" value={r.note} disabled={scanning || saving} onChange={(e) => update(i, { note: e.target.value })} />
            <div className="flex gap-1">
              <Button variant="ghost" size="icon-sm" aria-label={`Move item ${i + 1} up`} disabled={i === 0 || scanning || saving} onClick={() => move(i, -1)}>
                <ArrowUp />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={`Move item ${i + 1} down`} disabled={i === rows.length - 1 || scanning || saving} onClick={() => move(i, 1)}>
                <ArrowDown />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove item ${i + 1}`}
                disabled={scanning || saving}
                onClick={() => {
                  setRows((rs) => rs.filter((_, j) => j !== i));
                  setDirty(true);
                  setBeforeScan(null);
                }}
              >
                <Trash2 />
              </Button>
            </div>
            {error?.row === i && (
              <p role="alert" className="text-sm text-destructive md:col-span-5">
                {error.message}
              </p>
            )}
          </div>
        ))}
        <datalist id="menu-sections">
          {[...new Set(rows.map((r) => r.section.trim()).filter(Boolean))].map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={scanning || saving} onClick={() => { setRows((rs) => [...rs, { ...EMPTY }]); setDirty(true); setBeforeScan(null); }}>
          <Plus /> Add item
        </Button>
        <Button onClick={save} disabled={saving || scanning || !dirty}>
          {saving ? "Saving…" : "Save menu"}
        </Button>
      </div>
    </section>
  );
}

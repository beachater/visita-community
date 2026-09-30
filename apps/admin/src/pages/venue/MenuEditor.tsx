import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { Json } from "@visita/shared-types";
import { Button } from "@visita/ui/button";
import { Input } from "@visita/ui/input";
import { supabase } from "@/lib/supabase";
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

  const update = (i: number, patch: Partial<MenuRow>) => {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setDirty(true);
  };
  const move = (i: number, by: -1 | 1) => {
    setRows((rs) => {
      const next = [...rs];
      const [item] = next.splice(i, 1);
      next.splice(i + by, 0, item!);
      return next;
    });
    setDirty(true);
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
            <Input aria-label={`Item ${i + 1} name`} placeholder="Latte" value={r.name} onChange={(e) => update(i, { name: e.target.value })} />
            <Input aria-label={`Item ${i + 1} price`} inputMode="decimal" placeholder="140" value={r.price} onChange={(e) => update(i, { price: e.target.value })} />
            <Input aria-label={`Item ${i + 1} section`} placeholder="Coffee" value={r.section} onChange={(e) => update(i, { section: e.target.value })} list="menu-sections" />
            <Input aria-label={`Item ${i + 1} note`} placeholder="Iced +₱20" value={r.note} onChange={(e) => update(i, { note: e.target.value })} />
            <div className="flex gap-1">
              <Button variant="ghost" size="icon-sm" aria-label={`Move item ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={`Move item ${i + 1} down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove item ${i + 1}`}
                onClick={() => {
                  setRows((rs) => rs.filter((_, j) => j !== i));
                  setDirty(true);
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
        <Button variant="outline" onClick={() => setRows((rs) => [...rs, { ...EMPTY }])}>
          <Plus /> Add item
        </Button>
        <Button onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save menu"}
        </Button>
      </div>
    </section>
  );
}

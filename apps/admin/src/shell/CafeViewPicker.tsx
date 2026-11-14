import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Box, ChevronRight, Search, Store } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@visita/ui/dialog";
import { cn } from "@visita/ui/utils";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/lib/supabase";

// "Cafe view" for admins: open a cafe's owner workspace to see exactly what
// its owner sees. Cafes the admin owns come first, then every cafe. Admins
// can already edit any cafe; the preview only makes that view visible.

interface Row {
  id: string;
  name: string;
  scanned: boolean;
}

export function CafeViewPicker({ open, onOpenChange, onPicked }: { open: boolean; onOpenChange: (o: boolean) => void; onPicked?: () => void }) {
  const { access } = useAuth();
  const navigate = useNavigate();
  const [venues, setVenues] = useState<Row[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open || venues) return;
    supabase
      .from("venues")
      .select("id, name, splat_url")
      .order("name")
      .then(({ data }) => setVenues((data ?? []).map((v) => ({ id: v.id, name: v.name, scanned: Boolean(v.splat_url) }))));
  }, [open, venues]);

  const ownedIds = useMemo(() => new Set((access?.claims ?? []).filter((c) => c.status === "approved" && c.venueId).map((c) => c.venueId!)), [access]);
  const q = query.trim().toLowerCase();
  const list = (venues ?? []).filter((v) => !q || v.name.toLowerCase().includes(q));
  const owned = list.filter((v) => ownedIds.has(v.id));
  const others = list.filter((v) => !ownedIds.has(v.id));

  const pick = (id: string) => {
    onOpenChange(false);
    onPicked?.();
    navigate(`/venue/${id}`);
  };

  const item = (v: Row, sub: string) => (
    <li key={v.id}>
      <button type="button" onClick={() => pick(v.id)} className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left hover:bg-muted">
        <span className={cn("grid size-9.5 shrink-0 place-items-center rounded-xl", v.scanned ? "bg-scan" : "bg-accent")} aria-hidden="true">
          {v.scanned ? <Box className="size-4.5 text-[var(--brand-gold)]" strokeWidth={1.6} /> : <Store className="size-4.5 text-primary" />}
        </span>
        <span className="grid min-w-0 flex-1">
          <span className="truncate text-sm font-semibold">{v.name}</span>
          <span className="text-xs text-muted-foreground">{sub}</span>
        </span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
      </button>
    </li>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-4rem)] gap-3 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Open a cafe's owner view</DialogTitle>
          <DialogDescription>See exactly what that cafe's owner sees. Admin pages are hidden until you go back.</DialogDescription>
        </DialogHeader>
        <label className="flex h-12 items-center gap-2.5 rounded-full border bg-muted px-4 focus-within:outline-2 focus-within:outline-ring">
          <Search className="size-4.5 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Find a cafe</span>
          <input autoFocus type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a cafe" className="min-w-0 flex-1 bg-transparent outline-none" />
        </label>
        <div className="scroll-soft -mx-1 max-h-[50dvh] overflow-y-auto px-1">
          {venues === null && <p className="p-3 text-sm text-muted-foreground">Loading…</p>}
          {owned.length > 0 && (
            <section className="grid gap-1 pb-2">
              <h3 className="px-2.5 pt-1 text-[0.7rem] font-bold tracking-[0.12em] text-muted-foreground uppercase">Cafes you own</h3>
              <ul className="grid">{owned.map((v) => item(v, "You're an owner here"))}</ul>
            </section>
          )}
          {others.length > 0 && (
            <section className="grid gap-1">
              <h3 className="px-2.5 pt-1 text-[0.7rem] font-bold tracking-[0.12em] text-muted-foreground uppercase">Preview any cafe</h3>
              <ul className="grid">{others.map((v) => item(v, v.scanned ? "Scanned in 3D" : "Not scanned yet"))}</ul>
            </section>
          )}
          {venues !== null && list.length === 0 && <p className="p-3 text-sm text-muted-foreground">No cafe matches “{query.trim()}”.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

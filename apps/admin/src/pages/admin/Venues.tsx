import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { BadgeCheck, Plus, Search, Star } from "lucide-react";
import { Button } from "@visita/ui/button";
import { Input } from "@visita/ui/input";
import { cn } from "@visita/ui/utils";
import { supabase } from "@/lib/supabase";

// PRD 4.5 venue management: every venue, published or not.

interface Row {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  is_published: boolean;
  is_top_pick: boolean;
  splat_url: string | null;
  updated_at: string;
}

type Show = "all" | "published" | "draft";

export function Venues() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<Show>("all");

  useEffect(() => {
    supabase
      .from("venues")
      .select("id, slug, name, address, is_published, is_top_pick, splat_url, updated_at")
      .order("name")
      .then(({ data }) => setRows(data ?? []));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter(
      (r) =>
        (show === "all" || (show === "published") === r.is_published) &&
        (!q || r.name.toLowerCase().includes(q) || r.slug.includes(q) || (r.address ?? "").toLowerCase().includes(q)),
    );
  }, [rows, query, show]);

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Venues</h1>
          <p className="text-muted-foreground">{rows ? `${rows.length} venues, ${rows.filter((r) => r.is_published).length} published` : "Loading…"}</p>
        </div>
        <Button asChild>
          <Link to="/admin/venues/new">
            <Plus /> New venue
          </Link>
        </Button>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input aria-label="Search venues" placeholder="Name, slug or address" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
        </div>
        <div role="group" aria-label="Show" className="inline-flex rounded-full border bg-card p-1 shadow-card">
          {(["all", "published", "draft"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={show === s}
              onClick={() => setShow(s)}
              className={cn("min-h-11 rounded-full px-4 py-2 text-sm capitalize", show === s ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
            >
              {s === "draft" ? "Not published" : s}
            </button>
          ))}
        </div>
      </div>
      <ul className="divide-y overflow-hidden rounded-card border bg-card shadow-card">
        {shown.map((r) => (
          <li key={r.id}>
            <Link to={`/admin/venues/${r.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-accent">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{r.name}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  /{r.slug}
                  {r.address ? ` · ${r.address}` : ""}
                </span>
              </span>
              {r.is_top_pick && (
                <span className="inline-flex items-center gap-1 text-xs">
                  <Star className="size-3.5" aria-hidden="true" /> Top pick
                </span>
              )}
              {r.splat_url && (
                <span className="inline-flex items-center gap-1 text-xs">
                  <BadgeCheck className="size-3.5" aria-hidden="true" /> Scanned
                </span>
              )}
              <span className={cn("rounded-full border px-2 py-0.5 text-xs", r.is_published ? "border-success/40 text-success" : "text-muted-foreground")}>
                {r.is_published ? "Published" : "Not published"}
              </span>
            </Link>
          </li>
        ))}
        {rows && shown.length === 0 && <li className="px-4 py-6 text-center text-muted-foreground">No venues match.</li>}
      </ul>
    </div>
  );
}

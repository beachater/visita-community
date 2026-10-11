import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { Button } from "@visita/ui/button";
import { Switch } from "@visita/ui/switch";
import { cn } from "@visita/ui/utils";
import { supabase } from "@/lib/supabase";
import { DEMAND_SORTS, demandView, type DemandRow, type DemandSort } from "./demand-queue";

// PRD 4.5 demand queue (Tier 2): the cafes visitors most want to see inside,
// from "I want to see inside" taps. It's the list of cafes to approach for a
// scan next. Totals only; who tapped stays in the database.

const day = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" });

export function DemandQueue() {
  const [rows, setRows] = useState<DemandRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<DemandSort>("recent");
  const [showScanned, setShowScanned] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase.rpc("admin_demand_queue");
    if (error) {
      console.error("[demand]", error);
      setError("Couldn't load the demand queue. Try again, or check that the database is up to date.");
      return;
    }
    setRows(data as DemandRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => (rows ? demandView(rows, { sort, showScanned }) : []), [rows, sort, showScanned]);
  const met = rows?.filter((r) => r.scanned).length ?? 0;

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="font-display text-3xl font-bold">Demand queue</h1>
        <p className="text-muted-foreground">Cafes visitors asked to see inside. The ones at the top are the cafes to approach for a scan next.</p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Sort by" className="flex flex-wrap gap-1 rounded-full bg-accent/60 p-1">
          {DEMAND_SORTS.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={sort === s.value}
              onClick={() => setSort(s.value)}
              className={cn(
                "inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                sort === s.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={showScanned} onCheckedChange={setShowScanned} aria-label="Show scanned cafes" />
          Show cafes scanned since{met > 0 && ` (${met})`}
        </label>
      </div>

      {error && (
        <div className="grid justify-items-start gap-3 rounded-card bg-card p-5 shadow-card">
          <p role="alert">{error}</p>
          <Button variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      )}
      {!error && rows === null && <p className="text-muted-foreground">Loading…</p>}
      {rows && shown.length === 0 && (
        <p className="rounded-card border border-dashed border-mist bg-card/70 p-8 text-center text-muted-foreground">
          {rows.length === 0 ? "No requests yet. They appear here when visitors tap “I want to see inside” on an unscanned cafe." : "Every requested cafe has been scanned."}
        </p>
      )}

      {shown.length > 0 && (
        <ol className="grid gap-3">
          {shown.map((r, i) => (
            <li key={r.venue_id}>
              <Link to={`/admin/venues/${r.venue_id}`} className="grid gap-3 rounded-card bg-card p-4 shadow-card transition-colors hover:bg-accent/40 sm:grid-cols-[2rem_minmax(0,1fr)_auto_1rem] sm:items-center sm:gap-4">
                <span className="hidden text-sm font-medium text-muted-foreground sm:block" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="grid min-w-0 gap-1">
                  <span className="truncate font-medium">{r.name}</span>
                  {r.address && <span className="truncate text-sm text-muted-foreground">{r.address}</span>}
                  <span className="flex flex-wrap gap-1.5 text-xs">
                    {r.scanned && <span className="rounded-full bg-success/10 px-2 py-0.5 font-medium text-success">Scanned since</span>}
                    {r.has_owner ? <span className="rounded-full bg-accent px-2 py-0.5">Has an owner on Visita</span> : <span className="rounded-full bg-accent px-2 py-0.5">No owner yet</span>}
                    {!r.is_published && <span className="rounded-full bg-accent px-2 py-0.5 text-muted-foreground">Not published</span>}
                  </span>
                </span>
                <dl className="grid grid-cols-3 gap-4 text-center sm:text-right">
                  <div>
                    <dt className="text-xs text-muted-foreground">7 days</dt>
                    <dd className="text-lg font-medium tabular-nums">{r.last_7_days}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">30 days</dt>
                    <dd className="text-lg font-medium tabular-nums">{r.last_30_days}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">All time</dt>
                    <dd className="text-lg font-medium tabular-nums">{r.total}</dd>
                  </div>
                  <p className="col-span-3 text-xs text-muted-foreground">
                    Latest {day(r.last_at)}
                    {r.signed_in > 0 && ` · ${r.signed_in} signed in`}
                  </p>
                </dl>
                <ChevronRight className="hidden size-4 text-muted-foreground sm:block" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronRight, Plus } from "lucide-react";
import { Button } from "@visita/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@visita/ui/select";
import { supabase } from "@/lib/supabase";
import { formatDay, formatPhp, manilaToday, standing, type BillingStatus, type Standing } from "../../billing/billing";
import { StandingPill } from "../../billing/StandingPill";

// Manual billing, admin side (PRD 4.4/4.5, Tier 2): every cafe on a plan,
// who's paid up and who's overdue. Open a cafe to record a payment.

interface Row {
  venue_id: string;
  name: string;
  slug: string;
  plan: string;
  monthly_fee_php: number | null;
  status: BillingStatus;
  paid_through: string | null;
  last_paid_on: string | null;
  total_paid_php: number;
}

// Needs attention first.
const ORDER: Standing[] = ["overdue", "due_soon", "trial", "paid", "paused", "cancelled"];

export function BillingList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);
  const [unbilled, setUnbilled] = useState<{ id: string; name: string }[]>([]);
  const [adding, setAdding] = useState("");

  const load = useCallback(async () => {
    setError(false);
    const [overview, venues] = await Promise.all([supabase.rpc("admin_billing_overview"), supabase.from("venues").select("id, name").order("name")]);
    if (overview.error || venues.error) {
      console.error("[billing]", overview.error ?? venues.error);
      setError(true);
      return;
    }
    const billed = new Set(overview.data.map((r) => r.venue_id));
    setRows(overview.data as Row[]);
    setUnbilled((venues.data ?? []).filter((v) => !billed.has(v.id)));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = manilaToday();
  const sorted = useMemo(
    () =>
      (rows ?? [])
        .map((r) => ({ ...r, standing: standing(r.status, r.paid_through, today) }))
        .sort((a, b) => ORDER.indexOf(a.standing) - ORDER.indexOf(b.standing) || a.name.localeCompare(b.name)),
    [rows, today],
  );
  const overdue = sorted.filter((r) => r.standing === "overdue").length;

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="font-display text-3xl font-bold">Billing</h1>
          <p className="text-muted-foreground">
            {rows ? `${rows.length} cafes on a plan${overdue ? `, ${overdue} overdue` : ""}. Payments are recorded by hand until online payments are set up.` : "Loading…"}
          </p>
        </div>
        {unbilled.length > 0 && (
          <div className="flex items-center gap-2">
            <Select value={adding} onValueChange={setAdding}>
              <SelectTrigger className="w-56" aria-label="Cafe to add to billing">
                <SelectValue placeholder="Add a cafe…" />
              </SelectTrigger>
              <SelectContent>
                {unbilled.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button disabled={!adding} onClick={() => navigate(`/admin/billing/${adding}`)}>
              <Plus /> Set up
            </Button>
          </div>
        )}
      </header>

      {error && (
        <div className="grid justify-items-start gap-3 rounded-card bg-card p-5 shadow-card">
          <p role="alert">Couldn't load billing. Try again, or check that the database is up to date.</p>
          <Button variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      )}
      {rows?.length === 0 && (
        <p className="rounded-card border border-dashed border-mist bg-card/70 p-8 text-center text-muted-foreground">No cafes on a plan yet. Pick a cafe above to set one up.</p>
      )}

      {sorted.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-card bg-card shadow-card">
          {sorted.map((r) => (
            <li key={r.venue_id}>
              <Link to={`/admin/billing/${r.venue_id}`} className="grid gap-2 px-5 py-4 hover:bg-accent/50 sm:grid-cols-[minmax(0,1fr)_7rem_10rem_8rem_1rem] sm:items-center sm:gap-4">
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate font-medium">{r.name}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {r.plan}
                    {r.monthly_fee_php != null && ` · ${formatPhp(r.monthly_fee_php)} a month`}
                  </span>
                </span>
                <StandingPill standing={r.standing} />
                <span className="text-sm">
                  <span className="text-muted-foreground sm:hidden">Paid through </span>
                  {r.paid_through ? formatDay(r.paid_through) : <span className="text-muted-foreground">Never paid</span>}
                </span>
                <span className="text-sm tabular-nums sm:text-right">
                  <span className="text-muted-foreground sm:hidden">Total </span>
                  {formatPhp(r.total_paid_php)}
                </span>
                <ChevronRight className="hidden size-4 text-muted-foreground sm:block" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

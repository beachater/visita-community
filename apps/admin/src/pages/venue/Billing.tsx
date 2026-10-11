import { useCallback, useEffect, useState } from "react";
import { Button } from "@visita/ui/button";
import { supabase } from "@/lib/supabase";
import { formatDay, formatPhp, KIND_LABEL, manilaToday, METHOD_LABEL, standing, type BillingStatus, type PaymentKind, type PaymentMethod } from "../billing/billing";
import { StandingPill } from "../billing/StandingPill";
import { useVenue } from "./VenueLayout";

// An owner's billing (PRD 4.4): plan, whether they're paid up, and every
// payment Visita has recorded. Read-only: payments are made to the Visita
// team for now and recorded by an admin (manual billing, Tier 2).

interface OwnerBilling {
  plan: { plan: string; monthly_fee_php: number | null; status: BillingStatus } | null;
  paid_through: string | null;
  payments: {
    id: string;
    kind: PaymentKind;
    amount_php: number;
    paid_on: string;
    method: PaymentMethod;
    reference: string | null;
    period_start: string | null;
    period_end: string | null;
  }[];
}

export function Billing() {
  const { venue } = useVenue();
  const [billing, setBilling] = useState<OwnerBilling | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    const { data, error } = await supabase.rpc("owner_billing", { p_venue_id: venue.id });
    if (error) {
      console.error("[billing]", error);
      setError(true);
      return;
    }
    setBilling(data as unknown as OwnerBilling);
  }, [venue.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error)
    return (
      <div className="grid justify-items-start gap-3">
        <p role="alert">Couldn't load your billing. Try again in a moment.</p>
        <Button variant="outline" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );
  if (!billing) return <p className="text-muted-foreground">Loading…</p>;

  const { plan, paid_through: paidThrough, payments } = billing;
  return (
    <div className="grid max-w-3xl gap-6">
      <section className="grid gap-4 rounded-card bg-card p-5 shadow-card" aria-labelledby="plan-heading">
        <h2 id="plan-heading" className="font-display text-xl font-semibold">
          Your plan
        </h2>
        {plan ? (
          <dl className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1">
              <dt className="text-sm text-muted-foreground">Plan</dt>
              <dd className="font-medium">
                {plan.plan}
                {plan.monthly_fee_php != null && <span className="text-muted-foreground"> · {formatPhp(plan.monthly_fee_php)} a month</span>}
              </dd>
            </div>
            <div className="grid gap-1">
              <dt className="text-sm text-muted-foreground">Status</dt>
              <dd>
                <StandingPill standing={standing(plan.status, paidThrough, manilaToday())} />
              </dd>
            </div>
            <div className="grid gap-1">
              <dt className="text-sm text-muted-foreground">Paid through</dt>
              <dd className="font-medium">{paidThrough ? formatDay(paidThrough) : "No payments yet"}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-muted-foreground">You don't have a plan with Visita yet. The Visita team will set it up with you.</p>
        )}
        <p className="text-sm text-muted-foreground">To pay or ask about your plan, contact the Visita team. Payments are recorded here once received.</p>
      </section>

      <section className="grid gap-3" aria-labelledby="payments-heading">
        <h2 id="payments-heading" className="font-display text-xl font-semibold">
          Payments
        </h2>
        {payments.length === 0 ? (
          <p className="rounded-card border border-dashed border-mist bg-card/70 p-6 text-center text-muted-foreground">No payments recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-card bg-card shadow-card">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3">
                <span className="grid gap-0.5">
                  <span className="font-medium">
                    {KIND_LABEL[p.kind]}
                    {p.period_start && p.period_end && (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {formatDay(p.period_start)} – {formatDay(p.period_end)}
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Paid {formatDay(p.paid_on)} by {METHOD_LABEL[p.method]}
                    {p.reference && ` · Ref. ${p.reference}`}
                  </span>
                </span>
                <span className="font-medium tabular-nums">{formatPhp(p.amount_php)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

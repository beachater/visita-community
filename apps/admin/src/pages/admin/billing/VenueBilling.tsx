import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@visita/ui/button";
import { Input } from "@visita/ui/input";
import { Label } from "@visita/ui/label";
import { Textarea } from "@visita/ui/textarea";
import { cn } from "@visita/ui/utils";
import { supabase } from "@/lib/supabase";
import {
  formatDay,
  formatPhp,
  KIND_LABEL,
  manilaToday,
  METHOD_LABEL,
  nextPeriod,
  parsePaymentForm,
  standing,
  STATUS_LABEL,
  type BillingStatus,
  type PaymentForm,
  type PaymentKind,
  type PaymentMethod,
} from "../../billing/billing";
import { LabelSelect } from "../../billing/LabelSelect";
import { StandingPill } from "../../billing/StandingPill";

// One cafe's billing, admin side: its plan, every payment (voided ones
// included, struck through), and a form to record a payment. Payments are
// never edited or deleted: a mistake is voided with a reason and recorded again.

interface Plan {
  plan: string;
  monthly_fee_php: number | null;
  status: BillingStatus;
  admin_note: string | null;
}

interface Payment {
  id: string;
  kind: PaymentKind;
  amount_php: number;
  paid_on: string;
  method: PaymentMethod;
  reference: string | null;
  period_start: string | null;
  period_end: string | null;
  note: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
}

const blankPlan = { plan: "", fee: "", status: "active" as BillingStatus, note: "" };

export function VenueBilling() {
  const { venueId = "" } = useParams();
  const [venueName, setVenueName] = useState<string | null | undefined>(undefined);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [planForm, setPlanForm] = useState(blankPlan);
  const [savingPlan, setSavingPlan] = useState(false);

  const load = useCallback(async () => {
    const [v, b, p] = await Promise.all([
      supabase.from("venues").select("name").eq("id", venueId).maybeSingle(),
      supabase.from("venue_billing").select("plan, monthly_fee_php, status, admin_note").eq("venue_id", venueId).maybeSingle(),
      supabase
        .from("billing_payments")
        .select("id, kind, amount_php, paid_on, method, reference, period_start, period_end, note, voided_at, void_reason, created_at")
        .eq("venue_id", venueId)
        .order("paid_on", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);
    if (v.error || b.error || p.error) {
      console.error("[billing]", v.error ?? b.error ?? p.error);
      toast.error("Couldn't load this cafe's billing.");
      return;
    }
    setVenueName(v.data?.name ?? null);
    setPlan(b.data);
    setPayments(p.data ?? []);
    setPlanForm(
      b.data
        ? { plan: b.data.plan, fee: b.data.monthly_fee_php == null ? "" : String(b.data.monthly_fee_php), status: b.data.status, note: b.data.admin_note ?? "" }
        : blankPlan,
    );
  }, [venueId]);

  useEffect(() => {
    void load();
  }, [load]);

  const savePlan = async (e: FormEvent) => {
    e.preventDefault();
    const name = planForm.plan.trim();
    if (!name) return toast.error("Name the plan, like “Founder”.");
    const feeText = planForm.fee.trim().replace(/,/g, "");
    const fee = feeText === "" ? null : Number(feeText);
    if (fee !== null && !(Number.isFinite(fee) && fee >= 0)) return toast.error("Enter the monthly fee in pesos, or leave it empty.");
    const fields = { plan: name, monthly_fee_php: fee, status: planForm.status, admin_note: planForm.note.trim() || null };
    setSavingPlan(true);
    const { error } = plan
      ? await supabase.from("venue_billing").update(fields).eq("venue_id", venueId)
      : await supabase.from("venue_billing").insert({ venue_id: venueId, ...fields });
    setSavingPlan(false);
    if (error) return toast.error(error.message);
    toast.success(plan ? "Plan updated" : "Plan set up");
    void load();
  };

  if (venueName === undefined) return <p className="text-muted-foreground">Loading…</p>;
  if (venueName === null)
    return (
      <div className="grid gap-3">
        <p>This cafe doesn't exist.</p>
        <Link to="/admin/billing" className="w-fit underline">
          Back to billing
        </Link>
      </div>
    );

  const valid = payments.filter((p) => !p.voided_at);
  const paidThrough = valid.reduce<string | null>((max, p) => (p.period_end && (!max || p.period_end > max) ? p.period_end : max), null);

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <Link to="/admin/billing" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" /> Billing
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold">{venueName}</h1>
          {plan && <StandingPill standing={standing(plan.status, paidThrough, manilaToday())} />}
        </div>
        {plan && (
          <p className="text-muted-foreground">
            Paid through {paidThrough ? formatDay(paidThrough) : "— no subscription payments yet"} · {formatPhp(valid.reduce((s, p) => s + Number(p.amount_php), 0))} received in total
          </p>
        )}
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-6">
          {plan && <RecordPayment venueId={venueId} paidThrough={paidThrough} monthlyFee={plan.monthly_fee_php} onSaved={() => void load()} />}
          <PaymentHistory payments={payments} onChanged={() => void load()} />
        </div>

        <form onSubmit={(e) => void savePlan(e)} className="grid gap-4 rounded-card bg-card p-5 shadow-card" aria-labelledby="plan-form-heading">
          <h2 id="plan-form-heading" className="font-display text-xl font-semibold">
            {plan ? "Plan" : "Set up a plan"}
          </h2>
          {!plan && <p className="text-sm text-muted-foreground">Set up a plan before recording payments. The owner sees the plan name, fee and status.</p>}
          <div className="grid gap-1.5">
            <Label htmlFor="plan-name">Plan name</Label>
            <Input id="plan-name" value={planForm.plan} onChange={(e) => setPlanForm({ ...planForm, plan: e.target.value })} placeholder="Founder" maxLength={80} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="plan-fee">Monthly fee (₱, optional)</Label>
            <Input id="plan-fee" inputMode="decimal" value={planForm.fee} onChange={(e) => setPlanForm({ ...planForm, fee: e.target.value })} placeholder="150" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="plan-status">Status</Label>
            <LabelSelect id="plan-status" value={planForm.status} labels={STATUS_LABEL} onChange={(status) => setPlanForm({ ...planForm, status })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="plan-note">Admin note (owners never see this)</Label>
            <Textarea id="plan-note" value={planForm.note} onChange={(e) => setPlanForm({ ...planForm, note: e.target.value })} maxLength={1000} rows={3} />
          </div>
          <Button type="submit" disabled={savingPlan} className="w-fit">
            {plan ? "Save plan" : "Set up plan"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function RecordPayment({ venueId, paidThrough, monthlyFee, onSaved }: { venueId: string; paidThrough: string | null; monthlyFee: number | null; onSaved: () => void }) {
  const fresh = useCallback((): PaymentForm => {
    const today = manilaToday();
    const period = nextPeriod(paidThrough, today);
    return { kind: "subscription", amount: monthlyFee == null ? "" : String(monthlyFee), paidOn: today, method: "gcash", reference: "", periodStart: period.start, periodEnd: period.end, note: "" };
  }, [paidThrough, monthlyFee]);
  const [form, setForm] = useState<PaymentForm>(fresh);
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(fresh()), [fresh]);

  const set = (patch: Partial<PaymentForm>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = parsePaymentForm(venueId, form);
    if (!parsed.ok) return toast.error(parsed.error);
    setSaving(true);
    const { error } = await supabase.from("billing_payments").insert(parsed.row);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Recorded ${formatPhp(parsed.row.amount_php)}`);
    onSaved();
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-4 rounded-card bg-card p-5 shadow-card" aria-labelledby="pay-heading">
      <h2 id="pay-heading" className="font-display text-xl font-semibold">
        Record a payment
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="pay-kind">For</Label>
          <LabelSelect id="pay-kind" value={form.kind} labels={KIND_LABEL} onChange={(kind) => set({ kind })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pay-amount">Amount (₱)</Label>
          <Input id="pay-amount" inputMode="decimal" value={form.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="150" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pay-date">Paid on</Label>
          <Input id="pay-date" type="date" value={form.paidOn} onChange={(e) => set({ paidOn: e.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pay-method">Method</Label>
          <LabelSelect id="pay-method" value={form.method} labels={METHOD_LABEL} onChange={(method) => set({ method })} />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="pay-ref">Reference (optional)</Label>
          <Input id="pay-ref" value={form.reference} onChange={(e) => set({ reference: e.target.value })} placeholder="GCash or bank reference, receipt number" maxLength={120} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pay-start">Covers from{form.kind !== "subscription" && " (optional)"}</Label>
          <Input id="pay-start" type="date" value={form.periodStart} onChange={(e) => set({ periodStart: e.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pay-end">Covers until{form.kind !== "subscription" && " (optional)"}</Label>
          <Input id="pay-end" type="date" value={form.periodEnd} onChange={(e) => set({ periodEnd: e.target.value })} />
        </div>
        <div className="grid gap-1.5 sm:col-span-3">
          <Label htmlFor="pay-note">Note (optional)</Label>
          <Input id="pay-note" value={form.note} onChange={(e) => set({ note: e.target.value })} maxLength={500} />
        </div>
      </div>
      <Button type="submit" disabled={saving} className="w-fit">
        Record payment
      </Button>
    </form>
  );
}

function PaymentHistory({ payments, onChanged }: { payments: Payment[]; onChanged: () => void }) {
  const [voiding, setVoiding] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const voidPayment = async (id: string) => {
    if (!reason.trim()) return toast.error("Say why this payment is being voided.");
    const { error } = await supabase.from("billing_payments").update({ voided_at: new Date().toISOString(), void_reason: reason.trim() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Payment voided");
    setVoiding(null);
    setReason("");
    onChanged();
  };

  return (
    <section className="grid gap-3" aria-labelledby="history-heading">
      <h2 id="history-heading" className="font-display text-xl font-semibold">
        Payments
      </h2>
      {payments.length === 0 ? (
        <p className="rounded-card border border-dashed border-mist bg-card/70 p-6 text-center text-muted-foreground">No payments recorded yet.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-card bg-card shadow-card">
          {payments.map((p) => (
            <li key={p.id} className="grid gap-2 px-5 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className={cn("grid gap-0.5", p.voided_at && "text-muted-foreground")}>
                  <span className={cn("font-medium", p.voided_at && "line-through")}>
                    {KIND_LABEL[p.kind]}
                    {p.period_start && p.period_end && <span className="font-normal text-muted-foreground"> · {formatDay(p.period_start)} – {formatDay(p.period_end)}</span>}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Paid {formatDay(p.paid_on)} by {METHOD_LABEL[p.method]}
                    {p.reference && ` · Ref. ${p.reference}`}
                    {p.note && ` · ${p.note}`}
                  </span>
                  {p.voided_at && <span className="text-sm">Voided: {p.void_reason}</span>}
                </span>
                <span className="flex items-center gap-3">
                  <span className={cn("font-medium tabular-nums", p.voided_at && "text-muted-foreground line-through")}>{formatPhp(Number(p.amount_php))}</span>
                  {!p.voided_at && voiding !== p.id && (
                    <Button variant="ghost" size="sm" onClick={() => (setVoiding(p.id), setReason(""))}>
                      Void
                    </Button>
                  )}
                </span>
              </div>
              {voiding === p.id && (
                <div className="flex flex-wrap items-center gap-2">
                  <Input aria-label="Why this payment is being voided" placeholder="Why? e.g. recorded twice" value={reason} onChange={(e) => setReason(e.target.value)} className="min-w-56 flex-1" autoFocus />
                  <Button variant="destructive" size="sm" onClick={() => void voidPayment(p.id)}>
                    Void payment
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setVoiding(null)}>
                    Cancel
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

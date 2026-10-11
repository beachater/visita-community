// Manual billing (PRD 4.4, Tier 2): the rules behind the admin and owner
// billing pages. Dates are plain "YYYY-MM-DD" days; the database checks the
// same rules again.

import type { Database } from "@visita/shared-types";

type Enums = Database["public"]["Enums"];
export type BillingStatus = Enums["billing_status"];
export type PaymentMethod = Enums["payment_method"];
export type PaymentKind = Enums["payment_kind"];

export const STATUS_LABEL: Record<BillingStatus, string> = { trial: "Trial", active: "Active", paused: "Paused", cancelled: "Cancelled" };
export const METHOD_LABEL: Record<PaymentMethod, string> = { cash: "Cash", gcash: "GCash", bank_transfer: "Bank transfer", other: "Other" };
export const KIND_LABEL: Record<PaymentKind, string> = { subscription: "Subscription", onboarding: "Onboarding", other: "Other" };

/** Where a venue stands: its plan status, or for an active plan, whether it's paid up. */
export type Standing = "paid" | "due_soon" | "overdue" | "trial" | "paused" | "cancelled";

export const STANDING_LABEL: Record<Standing, string> = {
  paid: "Paid up",
  due_soon: "Due soon",
  overdue: "Overdue",
  trial: "Trial",
  paused: "Paused",
  cancelled: "Cancelled",
};

const DUE_SOON_DAYS = 7;

const toDate = (day: string) => new Date(`${day}T00:00:00Z`);
const toDay = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => {
  const d = toDate(day);
  d.setUTCDate(d.getUTCDate() + n);
  return toDay(d);
};

/** Today in Manila, as "YYYY-MM-DD". */
export const manilaToday = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(now);

export function standing(status: BillingStatus, paidThrough: string | null, today: string): Standing {
  if (status !== "active") return status;
  if (!paidThrough || paidThrough < today) return "overdue";
  return paidThrough <= addDays(today, DUE_SOON_DAYS - 1) ? "due_soon" : "paid";
}

/** The month a new subscription payment most likely covers. */
export function nextPeriod(paidThrough: string | null, today: string): { start: string; end: string } {
  const afterPaid = paidThrough ? addDays(paidThrough, 1) : today;
  const start = afterPaid > today ? afterPaid : today;
  const s = toDate(start);
  const year = s.getUTCFullYear();
  const month = s.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const sameDay = new Date(Date.UTC(year, month, Math.min(s.getUTCDate(), lastDay)));
  return { start, end: addDays(toDay(sameDay), -1) };
}

export interface PaymentForm {
  kind: PaymentKind;
  amount: string;
  paidOn: string;
  method: PaymentMethod;
  reference: string;
  periodStart: string;
  periodEnd: string;
  note: string;
}

export interface PaymentRow {
  venue_id: string;
  kind: PaymentKind;
  amount_php: number;
  paid_on: string;
  method: PaymentMethod;
  reference: string | null;
  period_start: string | null;
  period_end: string | null;
  note: string | null;
}

const PESOS = /^\d+(\.\d{1,2})?$/;

export function parsePaymentForm(venueId: string, f: PaymentForm): { ok: true; row: PaymentRow } | { ok: false; error: string } {
  const amountText = f.amount.trim().replace(/,/g, "");
  const amount = Number(amountText);
  if (!PESOS.test(amountText) || !(amount > 0)) return { ok: false, error: "Enter the amount in pesos, like 150 or 2,000.50." };
  if (!f.paidOn) return { ok: false, error: "Add the date it was paid." };
  const hasStart = Boolean(f.periodStart);
  const hasEnd = Boolean(f.periodEnd);
  if (f.kind === "subscription" && !(hasStart && hasEnd)) return { ok: false, error: "Say which period this payment covers." };
  if (hasStart !== hasEnd) return { ok: false, error: "Give both the start and end of the period, or neither." };
  if (hasStart && f.periodEnd < f.periodStart) return { ok: false, error: "The period has to end after it starts." };
  return {
    ok: true,
    row: {
      venue_id: venueId,
      kind: f.kind,
      amount_php: amount,
      paid_on: f.paidOn,
      method: f.method,
      reference: f.reference.trim() || null,
      period_start: f.periodStart || null,
      period_end: f.periodEnd || null,
      note: f.note.trim() || null,
    },
  };
}

const php = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 });
export const formatPhp = (amount: number) => php.format(amount).replace(/\.00$/, "");

export const formatDay = (day: string) => toDate(day).toLocaleDateString("en-PH", { timeZone: "UTC", dateStyle: "medium" });

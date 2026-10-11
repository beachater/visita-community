import { describe, expect, it } from "vitest";
import { nextPeriod, parsePaymentForm, standing, type PaymentForm } from "./billing";

describe("standing", () => {
  const today = "2026-10-12";
  it("is paid up while the paid-through date is ahead", () => expect(standing("active", "2026-10-31", today)).toBe("paid"));
  it("is due soon in the last week", () => expect(standing("active", "2026-10-18", today)).toBe("due_soon"));
  it("is due on the last paid day", () => expect(standing("active", "2026-10-12", today)).toBe("due_soon"));
  it("is overdue the day after", () => expect(standing("active", "2026-10-11", today)).toBe("overdue"));
  it("is overdue when an active plan has never been paid", () => expect(standing("active", null, today)).toBe("overdue"));
  it("follows the plan status when it isn't active", () => {
    expect(standing("trial", null, today)).toBe("trial");
    expect(standing("paused", "2026-01-31", today)).toBe("paused");
    expect(standing("cancelled", null, today)).toBe("cancelled");
  });
});

describe("nextPeriod", () => {
  it("starts the day after the paid-through date and runs a month", () => expect(nextPeriod("2026-10-31", "2026-10-12")).toEqual({ start: "2026-11-01", end: "2026-11-30" }));
  it("handles a mid-month cycle", () => expect(nextPeriod("2026-10-14", "2026-10-12")).toEqual({ start: "2026-10-15", end: "2026-11-14" }));
  it("clamps to the end of a short month", () => expect(nextPeriod("2027-01-30", "2027-01-01")).toEqual({ start: "2027-01-31", end: "2027-02-27" }));
  it("starts today when nothing has been paid", () => expect(nextPeriod(null, "2026-10-12")).toEqual({ start: "2026-10-12", end: "2026-11-11" }));
  it("starts today when the last period lapsed long ago", () => expect(nextPeriod("2026-06-30", "2026-10-12")).toEqual({ start: "2026-10-12", end: "2026-11-11" }));
});

describe("parsePaymentForm", () => {
  const form = (over: Partial<PaymentForm>): PaymentForm => ({
    kind: "subscription",
    amount: "150",
    paidOn: "2026-10-12",
    method: "gcash",
    reference: " GC-1 ",
    periodStart: "2026-10-12",
    periodEnd: "2026-11-11",
    note: "",
    ...over,
  });

  it("builds the row to insert", () =>
    expect(parsePaymentForm("v1", form({}))).toEqual({
      ok: true,
      row: { venue_id: "v1", kind: "subscription", amount_php: 150, paid_on: "2026-10-12", method: "gcash", reference: "GC-1", period_start: "2026-10-12", period_end: "2026-11-11", note: null },
    }));
  it("accepts pesos with centavos and thousands separators", () => expect(parsePaymentForm("v1", form({ kind: "onboarding", amount: "2,000.50" }))).toMatchObject({ ok: true, row: { amount_php: 2000.5 } }));
  it("refuses a zero, negative or unreadable amount", () => {
    for (const amount of ["0", "-5", "abc", "", "1.234"]) expect(parsePaymentForm("v1", form({ amount }))).toMatchObject({ ok: false });
  });
  it("needs the period for a subscription", () => expect(parsePaymentForm("v1", form({ periodStart: "", periodEnd: "" }))).toEqual({ ok: false, error: "Say which period this payment covers." }));
  it("lets other payments skip the period", () => expect(parsePaymentForm("v1", form({ kind: "onboarding", periodStart: "", periodEnd: "" }))).toMatchObject({ ok: true, row: { period_start: null, period_end: null } }));
  it("refuses a period that ends before it starts", () => expect(parsePaymentForm("v1", form({ periodEnd: "2026-10-01" }))).toEqual({ ok: false, error: "The period has to end after it starts." }));
  it("refuses half a period", () => expect(parsePaymentForm("v1", form({ kind: "other", periodEnd: "" }))).toMatchObject({ ok: false }));
  it("needs the date it was paid", () => expect(parsePaymentForm("v1", form({ paidOn: "" }))).toEqual({ ok: false, error: "Add the date it was paid." }));
});

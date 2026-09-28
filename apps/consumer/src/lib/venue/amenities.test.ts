import { describe, expect, it } from "vitest";
import type { AmenityDefinition } from "@visita/shared-types";
import { amenityRows, amenityShortText, amenityText, summaryRows } from "./amenities";

const def = (over: Partial<AmenityDefinition>): AmenityDefinition => ({
  venue_type: "cafe",
  key: "k",
  label: "Label",
  icon: null,
  value_type: "text",
  unit: null,
  is_filterable: false,
  summary_rank: null,
  sort_order: 100,
  requires_verification: true,
  is_active: true,
  created_at: "",
  updated_at: "",
  ...over,
});

const wifi = def({ key: "wifi", label: "Wi-Fi", value_type: "boolean", summary_rank: 1, sort_order: 10 });
const outlets = def({ key: "power_outlets", label: "Power outlets", value_type: "number", unit: "outlets", summary_rank: 2, sort_order: 20 });
const spend = def({ key: "min_spend", label: "Minimum spend", value_type: "number", unit: "PHP", sort_order: 110 });
const pay = def({ key: "payment_methods", label: "Payment", value_type: "list", sort_order: 50 });
const retired = def({ key: "karaoke", label: "Karaoke", value_type: "boolean", is_active: false, sort_order: 5 });

describe("amenityText", () => {
  it("prefers the stored label", () => expect(amenityText(outlets, { label: "7 inside, 2 outside", value: 9 })).toBe("7 inside, 2 outside"));
  it("formats a number with its unit", () => expect(amenityText(outlets, { value: 9 })).toBe("9 outlets"));
  it("formats pesos", () => expect(amenityText(spend, { value: 250 })).toBe("₱250"));
  it("joins a list", () => expect(amenityText(pay, { value: ["Cash", "GCash"] })).toBe("Cash, GCash"));
  it("says Yes for a true boolean", () => expect(amenityText(wifi, { value: true })).toBe("Yes"));
  it("returns nothing for an empty entry", () => expect(amenityText(pay, { value: [] })).toBeNull());
});

describe("amenityShortText", () => {
  it("keeps a short label", () => expect(amenityShortText(wifi, { label: "100 Mbps", value: true })).toBe("100 Mbps"));
  it("uses the value when the label is long", () => expect(amenityShortText(outlets, { label: "7 inside, 2 outside", value: 9 })).toBe("9 outlets"));
  it("falls back to a long label when there's no value", () =>
    expect(amenityShortText(outlets, { label: "Visitor pavilion · 4 outlets" })).toBe("Visitor pavilion · 4 outlets"));
});

describe("amenityRows", () => {
  const defs = [spend, retired, outlets, pay, wifi];
  const amenities = { wifi: { value: true }, power_outlets: { value: 9 }, karaoke: { value: true } };

  it("lists only known, active amenities in catalog order", () =>
    expect(amenityRows(defs, amenities).map((r) => r.key)).toEqual(["wifi", "power_outlets"]));
  it("returns nothing for a venue with no amenity data", () => expect(amenityRows(defs, {})).toEqual([]));
  it("summarises in summary_rank order", () => expect(summaryRows(defs, amenities).map((r) => r.key)).toEqual(["wifi", "power_outlets"]));
});

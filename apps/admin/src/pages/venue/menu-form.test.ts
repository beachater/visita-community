import { describe, expect, it } from "vitest";
import { menuFromRows, parsePrice, rowsFromMenu } from "./menu-form";

describe("parsePrice", () => {
  it.each([
    ["140", 140],
    ["₱140", 140],
    ["P 1,250.50", 1250.5],
    ["", undefined],
    ["  ", undefined],
  ])("%j → %s", (input, out) => expect(parsePrice(input)).toEqual({ ok: true, value: out }));
  it.each(["free", "-5", "12abc"])("rejects %j", (input) => expect(parsePrice(input).ok).toBe(false));
});

describe("menu editor", () => {
  it("round-trips a menu", () => {
    const menu = [
      { name: "Latte", price_php: 140, section: "Coffee" },
      { name: "Ensaymada", note: "Weekends only" },
    ];
    expect(menuFromRows(rowsFromMenu(menu))).toEqual({ ok: true, menu });
  });
  it("drops blank rows and trims text", () =>
    expect(menuFromRows([{ name: "  Mocha ", price: " 150 ", section: " ", note: "" }, { name: "", price: "", section: "", note: "" }])).toEqual({
      ok: true,
      menu: [{ name: "Mocha", price_php: 150 }],
    }));
  it("points at the row with a bad price", () =>
    expect(menuFromRows([{ name: "Latte", price: "cheap", section: "", note: "" }])).toEqual({ ok: false, row: 0, error: "Price must be a number, like 140." }));
  it("needs a name when a row has anything else", () =>
    expect(menuFromRows([{ name: "", price: "90", section: "", note: "" }])).toMatchObject({ ok: false, row: 0 }));
});

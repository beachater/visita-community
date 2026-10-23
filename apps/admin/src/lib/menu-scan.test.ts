import { describe, expect, it } from "vitest";
import { mergeScan, menuScanPath, menuScanVenueId, rowsFromScan } from "./menu-scan";

const row = (name: string, price = "", section = "", note = "") => ({ name, price, section, note });
const VENUE = "aaaaaaaa-0000-4000-8000-000000000001";

describe("menu scan route", () => {
  it("round-trips a venue id", () => expect(menuScanVenueId(menuScanPath(VENUE))).toBe(VENUE));
  it("ignores other paths", () => {
    expect(menuScanVenueId(`/api/venues/${VENUE}/menu`)).toBeNull();
    expect(menuScanVenueId("/api/venues/not-an-id/menu-scan")).toBeNull();
  });
});

describe("rowsFromScan", () => {
  it("reads the model's items into editor rows", () =>
    expect(rowsFromScan({ items: [{ name: " Latte ", price: 140, section: "Coffee", note: "Iced +20" }] })).toEqual([row("Latte", "140", "Coffee", "Iced +20")]));

  it("accepts the answer as JSON text, even wrapped in a code fence", () =>
    expect(rowsFromScan('```json\n{"items":[{"name":"Turon","price":"₱45.00"}]}\n```')).toEqual([row("Turon", "45")]));

  it("keeps a price it can't read in the note, so nothing is lost", () =>
    expect(rowsFromScan({ items: [{ name: "Cold brew", price: "150/180" }] })).toEqual([row("Cold brew", "", "", "Price on the photo: 150/180")]));

  it("skips items without a name and exact repeats", () =>
    expect(rowsFromScan({ items: [{ name: "" }, { price: 90 }, { name: "Mocha", price: 160 }, { name: "mocha ", price: 160 }] })).toEqual([row("Mocha", "160")]));

  it("returns nothing for an answer it can't read", () => {
    expect(rowsFromScan("Sorry, I can't see a menu")).toEqual([]);
    expect(rowsFromScan(null)).toEqual([]);
    expect(rowsFromScan({ items: "lots" })).toEqual([]);
  });

  it("caps a runaway answer at 200 items", () =>
    expect(rowsFromScan({ items: Array.from({ length: 250 }, (_, i) => ({ name: `Item ${i}` })) })).toHaveLength(200));
});

describe("mergeScan", () => {
  it("updates prices of items already on the menu and adds the rest", () =>
    expect(mergeScan([row("Latte", "130", "Coffee", "Iced +20"), row("Turon", "40")], [row("latte", "140", "coffee"), row("Ensaymada", "60")])).toEqual({
      rows: [row("Latte", "140", "Coffee", "Iced +20"), row("Turon", "40"), row("Ensaymada", "60")],
      added: 1,
      updated: 1,
    }));

  it("leaves an existing price alone when the photo shows none, or the same one", () =>
    expect(mergeScan([row("Latte", "140")], [row("Latte"), row("LATTE", "140")])).toEqual({ rows: [row("Latte", "140")], added: 0, updated: 0 }));

  it("drops the editor's blank starter row", () => expect(mergeScan([row("")], [row("Latte", "140")])).toEqual({ rows: [row("Latte", "140")], added: 1, updated: 0 }));

  it("keeps items with the same name in different sections separate", () =>
    expect(mergeScan([row("Tea", "80", "Hot")], [row("Tea", "90", "Iced")])).toEqual({
      rows: [row("Tea", "80", "Hot"), row("Tea", "90", "Iced")], added: 1, updated: 0,
    }));
});

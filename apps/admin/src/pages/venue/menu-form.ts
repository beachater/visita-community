import type { MenuItem } from "@visita/shared-types";

// The menu editor works on text rows; venues.menu stores numbers for prices
// so the public price filter can use them.

export interface MenuRow {
  name: string;
  price: string;
  section: string;
  note: string;
}

export function parsePrice(text: string): { ok: true; value: number | undefined } | { ok: false } {
  const cleaned = text.replace(/[₱,\s]|^P/gi, "");
  if (cleaned === "") return { ok: true, value: undefined };
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return { ok: false };
  return { ok: true, value: Number(cleaned) };
}

export function rowsFromMenu(menu: MenuItem[]): MenuRow[] {
  return menu.map((m) => ({
    name: m.name,
    price: m.price_php === undefined ? "" : String(m.price_php),
    section: m.section ?? "",
    note: m.note ?? "",
  }));
}

export type MenuResult = { ok: true; menu: MenuItem[] } | { ok: false; row: number; error: string };

export function menuFromRows(rows: MenuRow[]): MenuResult {
  const menu: MenuItem[] = [];
  for (const [i, r] of rows.entries()) {
    const name = r.name.trim();
    const blank = !name && !r.price.trim() && !r.section.trim() && !r.note.trim();
    if (blank) continue;
    if (!name) return { ok: false, row: i, error: "Give this item a name." };
    const price = parsePrice(r.price);
    if (!price.ok) return { ok: false, row: i, error: "Price must be a number, like 140." };
    const item: MenuItem = { name };
    if (price.value !== undefined) item.price_php = price.value;
    if (r.section.trim()) item.section = r.section.trim();
    if (r.note.trim()) item.note = r.note.trim();
    menu.push(item);
  }
  return { ok: true, menu };
}

import { parsePrice, type MenuRow } from "../pages/venue/menu-form";

// Menu photo capture (PRD 4.4, Tier 2): an owner photographs the menu board,
// a vision model reads it, and the items land in the menu editor for the
// owner to check. Nothing saves until they press Save. Shared by the Worker
// (route, prompt, schema) and the app (parsing, merging).

const ROUTE = /^\/api\/venues\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/menu-scan$/i;

export const menuScanPath = (venueId: string) => `/api/venues/${venueId}/menu-scan`;

export function menuScanVenueId(pathname: string): string | null {
  return ROUTE.exec(pathname)?.[1] ?? null;
}

export const MENU_SCAN_PROMPT = [
  "This is a photo of a cafe menu in the Philippines. List every item you can read with its price in pesos.",
  "Copy names as written. Use the menu's own headings as sections.",
  "If an item has sizes or add-ons, put the base price in price and the rest in note, like \"Large +₱20\".",
  "Leave price out if you can't read it. Don't invent items.",
  'Return only a JSON object with an "items" array. Each item has a name and optional price, section and note.',
].join(" ");

export const MENU_SCAN_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          price: { type: "number" },
          section: { type: "string" },
          note: { type: "string" },
        },
        required: ["name"],
      },
    },
  },
  required: ["items"],
} as const;

const MAX_ITEMS = 200;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "");
const same = (a: string, b: string) => a.trim().toLowerCase().replace(/\s+/g, " ") === b.trim().toLowerCase().replace(/\s+/g, " ");

function parseAnswer(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const body = raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

/** The model's answer (object or JSON text) as editor rows. Anything unreadable is dropped. */
export function rowsFromScan(raw: unknown): MenuRow[] {
  const answer = parseAnswer(raw) as { items?: unknown } | null;
  if (!answer || !Array.isArray(answer.items)) return [];

  const rows: MenuRow[] = [];
  for (const item of answer.items as Record<string, unknown>[]) {
    if (rows.length === MAX_ITEMS) break;
    if (!item || typeof item !== "object") continue;
    const name = text(item.name, 120);
    if (!name) continue;
    const section = text(item.section, 60);
    if (rows.some((r) => same(r.name, name) && same(r.section, section))) continue;

    const shown = text(item.price, 40);
    const price = parsePrice(shown);
    let note = text(item.note, 200);
    if (!price.ok) note = [note, `Price on the photo: ${shown}`].filter(Boolean).join(" · ");
    rows.push({ name, price: price.ok && price.value !== undefined ? String(price.value) : "", section, note });
  }
  return rows;
}

/**
 * Fold scanned rows into the editor's rows. An item already on the menu (same
 * name and section takes the photo's price; everything else is added at the
 * end. Matching sections avoids overwriting a different item with the same
 * name. The owner still reviews and saves.
 */
export function mergeScan(current: MenuRow[], scanned: MenuRow[]): { rows: MenuRow[]; added: number; updated: number } {
  const rows = current.filter((r) => r.name.trim() || r.price.trim() || r.section.trim() || r.note.trim()).map((r) => ({ ...r }));
  let added = 0;
  let updated = 0;
  for (const s of scanned) {
    const existing = rows.find((r) => same(r.name, s.name) && same(r.section, s.section));
    if (!existing) {
      rows.push({ ...s });
      added++;
    } else if (s.price) {
      const previous = parsePrice(existing.price);
      if (!previous.ok || previous.value !== Number(s.price)) {
        existing.price = s.price;
        updated++;
      }
    }
  }
  return { rows, added, updated };
}

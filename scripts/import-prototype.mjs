#!/usr/bin/env node
// One-off import of the client prototype's cafes.json into the local database,
// for testing. The prototype is a reference for flow and content only; this
// maps its records onto our schema and doesn't carry over its data model.
//
// Usage:
//   SUPABASE_SECRET_KEY=<secret from `supabase status`> \
//     node scripts/import-prototype.mjs <path/to/cafes.json> [--dry-run]
//
// - Upserts on slug, so it's safe to re-run.
// - Refuses non-local URLs unless --allow-remote is passed.
// - Luma captures are not imported as walkthroughs (Visita is .sog only);
//   those cafes come in unscanned until their scans are re-exported.
// - SuperSplat scans map to the R2 key splats/<slug>/v1.sog. The files
//   themselves are bundled and uploaded separately; see infra/r2/README.md.

import { readFile } from "node:fs/promises";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
const allowRemote = args.includes("--allow-remote");

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:55421";
const key = process.env.SUPABASE_SECRET_KEY;

if (!file) fail("pass the path to the prototype's data/cafes.json");
if (!dryRun && !key) fail("set SUPABASE_SECRET_KEY (the Secret key printed by `supabase status`)");
if (!allowRemote && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url)) {
  fail(`refusing to import test data into ${url}; pass --allow-remote if you mean it`);
}

const records = JSON.parse(await readFile(file, "utf8"));
if (!Array.isArray(records)) fail("expected cafes.json to be an array");

const notes = [];
const rows = records.map(toVenue);

for (const n of notes) console.log(`note: ${n}`);

if (dryRun) {
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

const res = await fetch(`${url}/rest/v1/venues?on_conflict=slug`, {
  method: "POST",
  headers: {
    apikey: key,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=representation",
  },
  body: JSON.stringify(rows),
});

if (!res.ok) fail(`import failed (${res.status}): ${await res.text()}`);

const saved = await res.json();
for (const v of saved) {
  const walk = v.splat_url ? "walkthrough" : "unscanned";
  console.log(`imported ${v.slug.padEnd(20)} ${walk.padEnd(12)} ${Object.keys(v.amenities).length} amenities, ${v.menu.length} menu items`);
}

// ─── Mapping ────────────────────────────────────────────────────────────────

function toVenue(c) {
  if (c.lumaCaptureUrl && !c.superSplatUrl) {
    notes.push(`${c.slug}: Luma capture skipped; re-export as .sog to give it a walkthrough`);
  }
  return {
    slug: c.slug,
    venue_type: "cafe",
    name: c.displayName,
    address: c.directionsDestination ?? null,
    lat: c.lat ?? null,
    lng: c.lng ?? null,
    search_terms: Array.isArray(c.searchTerms) ? c.searchTerms : [],
    splat_url: c.superSplatUrl ? `splats/${c.slug}/v1.sog` : null,
    scanned_at: c.scanDate ?? null,
    amenities: toAmenities(c),
    hours: c.hours ?? null,
    menu: toMenu(c.menu),
    is_top_pick: c.topPick === true,
    is_published: c.internal !== true,
  };
}

function toAmenities(c) {
  const a = c.amenities ?? {};
  const out = {};
  const put = (k, entry) => {
    if (entry && (entry.label !== undefined || entry.value !== undefined)) out[k] = entry;
  };

  put("wifi", textEntry(a.wifi, (t) => !/\b(no|none|not available)\b/i.test(t)));
  put("power_outlets", textEntry(a.outlets, sumOfNumbers));
  put("tables", textEntry(a.availableTables, sumOfNumbers));
  put("seats", textEntry(a.availableChairs, sumOfNumbers));
  put("payment_methods", textEntry(a.paymentModes, splitList));
  put("climate", textEntry(a.aircon));
  put("table_types", listEntry(c.tableTypes));
  put("accessibility", listEntry(c.accessibility));
  put("restroom", boolEntry(c.restroom));
  put("parking", boolEntry(c.parking));
  put("outdoor", boolEntry(c.outdoor));
  put("min_spend", numberEntry(c.minSpend));
  put("time_limit", numberEntry(c.timeLimit));

  // Not amenities in our model: storeHours (structured `hours` replaces it)
  // and cafeName (that's `name`).
  if (known(a.storeHours)) notes.push(`${c.slug}: dropped hours text "${a.storeHours}" (structured hours kept)`);
  return out;
}

/** Display text plus an optional value derived from it. Unknown → undefined. */
function textEntry(raw, deriveValue) {
  if (!known(raw)) return undefined;
  const label = String(raw).split("\n").map((s) => s.trim()).filter(Boolean).join(", ");
  const value = deriveValue ? deriveValue(String(raw)) : undefined;
  return value === undefined ? { label } : { label, value };
}

function listEntry(raw) {
  if (!known(raw)) return undefined;
  const value = Array.isArray(raw) ? raw.map(String) : splitList(String(raw));
  return value.length ? { value } : undefined;
}

function boolEntry(raw) {
  if (!known(raw)) return undefined;
  if (typeof raw === "boolean") return { value: raw };
  return { label: String(raw) };
}

function numberEntry(raw) {
  if (!known(raw)) return undefined;
  if (typeof raw === "number" && raw >= 0) return { value: raw };
  const n = sumOfNumbers(String(raw));
  return n === undefined ? { label: String(raw) } : { label: String(raw), value: n };
}

function toMenu(menu) {
  if (!Array.isArray(menu)) return [];
  return menu
    .filter((m) => m && known(m.name))
    .map((m) => {
      const price = parsePrice(m.price);
      return price === undefined ? { name: m.name } : { name: m.name, price_php: price };
    });
}

// "7 inside\n2 outside" → 9. No digits → undefined (unknown, not zero).
function sumOfNumbers(text) {
  const nums = text.match(/\d+/g);
  return nums ? nums.reduce((s, n) => s + Number(n), 0) : undefined;
}

function splitList(text) {
  return text.split(/\n|,|·/).map((s) => s.trim()).filter(Boolean);
}

// "₱1,200" → 1200
function parsePrice(raw) {
  if (typeof raw === "number") return raw;
  const m = String(raw ?? "").replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : undefined;
}

// The prototype uses null, "" and "—" for unknown.
function known(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim() !== "" && v.trim() !== "—";
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function fail(msg) {
  console.error(`import-prototype: ${msg}`);
  process.exit(1);
}

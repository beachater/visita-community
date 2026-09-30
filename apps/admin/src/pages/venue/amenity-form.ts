import type { AmenityDefinition, AmenityEntry } from "@visita/shared-types";

// Turning the amenity request form into a stored {label?, value?} entry, and
// describing an entry for the owner. The database validates entries again.

type Def = Pick<AmenityDefinition, "value_type" | "unit">;

export function toEntry(def: Def, raw: string, label: string): AmenityEntry | "invalid" | null {
  const text = raw.trim();
  const out: AmenityEntry = {};
  if (def.value_type === "boolean") {
    if (text === "yes") out.value = true;
    else if (text === "no") out.value = false;
  } else if (def.value_type === "number") {
    if (text) {
      if (!/^\d+(\.\d+)?$/.test(text)) return "invalid";
      out.value = Number(text);
    }
  } else if (def.value_type === "list") {
    const items = text.split(",").map((s) => s.trim()).filter(Boolean);
    if (items.length) out.value = items;
  } else if (text) {
    out.value = text;
  }
  if (label.trim()) out.label = label.trim();
  return Object.keys(out).length ? out : null;
}

export function describeEntry(def: Def, entry: AmenityEntry | null | undefined): string {
  if (!entry) return "Not listed";
  if (entry.label) return entry.label;
  const v = entry.value;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.join(", ");
  return v === undefined ? "Not listed" : `${v}${def.unit ? ` ${def.unit}` : ""}`;
}

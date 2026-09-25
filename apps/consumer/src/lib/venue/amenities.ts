import type { AmenityDefinition, AmenityEntry, VenueAmenities } from "@visita/shared-types";

// Turns stored amenities plus the configurable catalog (amenity_definitions)
// into display rows. Only amenities that are both defined and active and
// actually known for this venue are returned: nothing is guessed.

export interface AmenityRow {
  key: string;
  label: string;
  icon: string | null;
  text: string;
}

const php = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

/** The stored label wins; otherwise the value is formatted by its type and unit. */
export function amenityText(def: AmenityDefinition, entry: AmenityEntry): string | null {
  if (entry.label?.trim()) return entry.label.trim();
  const value = entry.value;
  if (value === undefined || value === null) return null;

  switch (def.value_type) {
    case "boolean":
      return value ? "Yes" : "No";
    case "number": {
      const n = Number(value);
      if (def.unit === "PHP") return php.format(n);
      return def.unit ? `${n.toLocaleString("en-PH")} ${def.unit}` : n.toLocaleString("en-PH");
    }
    case "list":
      return Array.isArray(value) && value.length ? value.join(", ") : null;
    case "text":
      return String(value).trim() || null;
  }
}

function rows(
  defs: AmenityDefinition[],
  amenities: VenueAmenities,
  pick: (d: AmenityDefinition) => boolean,
  order: (d: AmenityDefinition) => number,
): AmenityRow[] {
  const out: { row: AmenityRow; order: number }[] = [];
  for (const def of defs) {
    if (!def.is_active || !pick(def)) continue;
    const entry = amenities[def.key];
    if (!entry) continue;
    const text = amenityText(def, entry);
    if (!text) continue;
    out.push({ row: { key: def.key, label: def.label, icon: def.icon, text }, order: order(def) });
  }
  return out.sort((a, b) => a.order - b.order).map((o) => o.row);
}

/** Every known amenity, in catalog order. */
export function amenityRows(defs: AmenityDefinition[], amenities: VenueAmenities): AmenityRow[] {
  return rows(defs, amenities, () => true, (d) => d.sort_order);
}

/** The collapsed three-stat strip: definitions with a summary_rank, in rank order. */
export function summaryRows(defs: AmenityDefinition[], amenities: VenueAmenities): AmenityRow[] {
  return rows(defs, amenities, (d) => d.summary_rank !== null, (d) => d.summary_rank ?? 0);
}

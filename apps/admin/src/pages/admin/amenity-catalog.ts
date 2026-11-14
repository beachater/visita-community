import type { AmenityDefinition } from "@visita/shared-types";

// Rules for the Amenities & filters page. Kept apart from the page so they
// can be tested. The database enforces the same key shape (check constraint)
// and admin-only writes (RLS); these give a clear message first.

export type ValueType = AmenityDefinition["value_type"];

export const VALUE_TYPES: { value: ValueType; label: string; hint: string }[] = [
  { value: "boolean", label: "Yes / no", hint: "Restroom, parking. Can be a “must have” filter." },
  { value: "number", label: "Number", hint: "Outlets, seats. Can be an “N or more” filter." },
  { value: "text", label: "Text", hint: "Climate: “2 aircons, 2 fans”. Not a filter." },
  { value: "list", label: "List", hint: "Payment methods. Not a filter." },
];

/** Only yes/no and number amenities can be offered as map filters. */
export const canFilter = (type: ValueType): boolean => type === "boolean" || type === "number";

/** "Pet friendly!" → "pet_friendly". The key is stored on every venue's amenities. */
export function keyFromLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[0-9_]+/, "")
    .slice(0, 40);
}

export interface NewAmenity {
  label: string;
  key: string;
  valueType: ValueType;
  unit: string;
  icon: string;
  filterable: boolean;
}

/** The first problem with a new amenity, or null when it can be saved. */
export function newAmenityError(a: NewAmenity, existing: Pick<AmenityDefinition, "key">[]): string | null {
  if (!a.label.trim()) return "Give it a name.";
  if (!/^[a-z][a-z0-9_]*$/.test(a.key)) return "The key must start with a letter and use only a–z, 0–9 and _.";
  if (existing.some((d) => d.key === a.key)) return `There's already an amenity with the key “${a.key}”. Pick another, or turn the existing one back on.`;
  if (a.filterable && !canFilter(a.valueType)) return "Only yes/no and number amenities can be filters.";
  return null;
}

/** New rows go to the end of the list. */
export const nextSortOrder = (defs: Pick<AmenityDefinition, "sort_order">[]): number =>
  defs.reduce((max, d) => Math.max(max, d.sort_order), 0) + 10;

import {
  Accessibility,
  Armchair,
  Baby,
  Bath,
  Car,
  Check,
  Coffee,
  CreditCard,
  Hourglass,
  LayoutGrid,
  Leaf,
  Music,
  PawPrint,
  Plug,
  Receipt,
  Snowflake,
  Sun,
  Table2,
  Users,
  Wifi,
  type LucideIcon,
} from "lucide-react";

// The icons an amenity can use. `amenity_definitions.icon` stores one of these
// names; the admin app offers them in a picker and the visitor site draws them
// on fact tiles and filter tiles. Add a name here to make it available to both.

export const AMENITY_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  wifi: { icon: Wifi, label: "Wi-Fi" },
  plug: { icon: Plug, label: "Plug" },
  table: { icon: Table2, label: "Table" },
  chair: { icon: Armchair, label: "Chair" },
  "credit-card": { icon: CreditCard, label: "Card" },
  snowflake: { icon: Snowflake, label: "Snowflake" },
  layout: { icon: LayoutGrid, label: "Layout" },
  restroom: { icon: Bath, label: "Restroom" },
  car: { icon: Car, label: "Car" },
  leaf: { icon: Leaf, label: "Leaf" },
  receipt: { icon: Receipt, label: "Receipt" },
  hourglass: { icon: Hourglass, label: "Hourglass" },
  accessibility: { icon: Accessibility, label: "Accessibility" },
  coffee: { icon: Coffee, label: "Coffee" },
  music: { icon: Music, label: "Music" },
  "paw-print": { icon: PawPrint, label: "Pets" },
  baby: { icon: Baby, label: "Baby" },
  sun: { icon: Sun, label: "Sun" },
  users: { icon: Users, label: "People" },
};

/** The glyph for a stored icon name; a check mark when it's unknown or empty. */
export function amenityIcon(name: string | null | undefined): LucideIcon {
  return (name && AMENITY_ICONS[name]?.icon) || Check;
}

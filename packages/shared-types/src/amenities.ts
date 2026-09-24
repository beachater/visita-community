import type { Database } from "./database.types";

type PublicSchema = Database["public"];

export type VenueType = PublicSchema["Enums"]["venue_type"];
export type AmenityValueType = PublicSchema["Enums"]["amenity_value_type"];

/**
 * One row of `amenity_definitions`: which amenities a venue type has, how
 * they display, and whether they filter. The catalog lives in the database so
 * amenities can be added or retired without a deploy.
 */
export type AmenityDefinition = PublicSchema["Tables"]["amenity_definitions"]["Row"];

/** The `value` type each `amenity_value_type` stores. */
export interface AmenityValueByType {
  boolean: boolean;
  number: number;
  text: string;
  list: string[];
}

/**
 * One stored amenity. `label` is what the card shows ("7 inside, 2 outside"),
 * `value` is what filters use (9). At least one is present; the database
 * rejects anything else.
 */
export interface AmenityEntry<T extends AmenityValueType = AmenityValueType> {
  label?: string;
  value?: AmenityValueByType[T];
}

/**
 * Shape of `venues.amenities`, keyed by `amenity_definitions.key`. An unknown
 * amenity is absent (never null or a placeholder), so the UI renders only
 * what's known.
 */
export type VenueAmenities = Record<string, AmenityEntry>;

/**
 * Shape of `venues.hours`. A missing day is unknown (no open/closed pill),
 * null is closed, and a close time earlier than the open time runs past
 * midnight.
 */
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type WeeklyHours = Partial<Record<Weekday, [opens: string, closes: string] | null>>;

/** One item of `venues.menu`. Price is a number so price filters can use it. */
export interface MenuItem {
  name: string;
  price_php?: number;
  section?: string;
  note?: string;
}

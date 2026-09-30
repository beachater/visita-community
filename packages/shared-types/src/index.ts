export type { Database, Json } from "./database.types";
export type {
  AmenityDefinition,
  AmenityEntry,
  AmenityValueByType,
  AmenityValueType,
  MenuItem,
  VenueAmenities,
  VenueType,
  Weekday,
  WeeklyHours,
} from "./amenities";

import type { Database } from "./database.types";

type PublicSchema = Database["public"];

/** Row type for a public table, e.g. `Tables<"venues">`. */
export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];

/** Enum values, e.g. `Enums<"review_status">`. */
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];

export { OCCUPANCY_LABEL, currentOccupancy, setAgo, type OccupancyLevel, type OccupancyRow } from "./occupancy";

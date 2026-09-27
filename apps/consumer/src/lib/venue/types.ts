import type { MenuItem, VenueAmenities, WeeklyHours } from "@visita/shared-types";

/**
 * Everything the walkthrough screen needs about one venue. Serializable, so
 * the cafe page (built at deploy time) and the map (fetched at runtime) can
 * both hand it to the same island.
 */
export interface WalkthroughCafe {
  slug: string;
  name: string;
  address: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
  googlePlaceId: string | null;
  /** R2 keys. */
  splatKey: string;
  previewKey: string | null;
  scannedAt: string | null;
  amenities: VenueAmenities;
  hours: WeeklyHours | null;
  menu: MenuItem[];
}

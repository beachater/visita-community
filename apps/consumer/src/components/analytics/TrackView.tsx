import { useEffect } from "react";
import { track } from "@/lib/analytics/track";

// Records one profile view of a cafe page (PRD 4.4), only with consent (the
// tracker checks). Renders nothing.
export function TrackView({ venueId }: { venueId: string }) {
  useEffect(() => track("profile_view", venueId), [venueId]);
  return null;
}

// Visitor amenity reports (PRD 4.3 amenity verification, Tier 2): open
// "something's changed" reports grouped per venue and amenity, so an admin
// checks each amenity once however many visitors flagged it.

export interface DisputeRow {
  id: string;
  venue_id: string;
  venue_name: string;
  amenity_key: string;
  comment: string | null;
  reporter: string;
  created_at: string;
}

export interface ConfirmRow {
  venue_id: string;
  amenity_key: string;
  created_at: string;
}

export interface DisputeGroup {
  venueId: string;
  venueName: string;
  amenityKey: string;
  reports: DisputeRow[];
  firstAt: string;
  lastAt: string;
  /** Visitors who said "still right" after the first report: a counter-signal. */
  confirmsSince: number;
}

const keyOf = (r: { venue_id: string; amenity_key: string }) => `${r.venue_id}:${r.amenity_key}`;

// Most-reported first, then the one waiting longest.
export function groupDisputes(disputes: DisputeRow[], confirms: ConfirmRow[]): DisputeGroup[] {
  const byKey = new Map<string, DisputeRow[]>();
  for (const d of disputes) byKey.set(keyOf(d), [...(byKey.get(keyOf(d)) ?? []), d]);

  return [...byKey.entries()]
    .map(([key, rows]) => {
      const reports = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
      const latest = reports[0]!;
      const firstAt = reports[reports.length - 1]!.created_at;
      return {
        venueId: latest.venue_id,
        venueName: latest.venue_name,
        amenityKey: latest.amenity_key,
        reports,
        firstAt,
        lastAt: latest.created_at,
        confirmsSince: confirms.filter((c) => keyOf(c) === key && c.created_at > firstAt).length,
      };
    })
    .sort((a, b) => b.reports.length - a.reports.length || a.firstAt.localeCompare(b.firstAt));
}

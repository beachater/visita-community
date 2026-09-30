// Occupancy (PRD 4.4): an owner's one-tap "how busy is it", which expires
// three hours after it's set. The database already hides expired rows; this
// also hides one that expires while the page stays open.

export type OccupancyLevel = "quiet" | "moderate" | "full";

export interface OccupancyRow {
  level: OccupancyLevel;
  set_at: string;
  expires_at: string;
}

export const OCCUPANCY_LABEL: Record<OccupancyLevel, string> = { quiet: "Quiet", moderate: "Moderate", full: "Full" };

/** "just now", "20 min ago", "2 hr ago". */
export function setAgo(setAt: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - new Date(setAt).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} hr ago`;
}

export function currentOccupancy(row: OccupancyRow | null | undefined, now: Date): { level: OccupancyLevel; ago: string } | null {
  if (!row || new Date(row.expires_at).getTime() <= now.getTime()) return null;
  return { level: row.level, ago: setAgo(row.set_at, now) };
}

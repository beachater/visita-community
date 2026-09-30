// Shaping venue_stats() output for the owner's analytics page. Totals only:
// the database never returns individual visits.

export interface DayPoint {
  day: string;
  profile_view: number;
  walkthrough_open: number;
  directions_tap: number;
}

export interface PeakCell {
  dow: number; // ISO weekday, 1 = Monday
  hour: number;
  count: number;
}

export interface VenueStats {
  totals: Record<"profile_view" | "walkthrough_open" | "directions_tap" | "search_appearance" | "filter_click" | "demand_tap", number>;
  conversion: number | null;
  peak: PeakCell[];
  filters: { filter: string; count: number }[];
  daily: DayPoint[];
  demand_before_signup: number;
}

export function rangeFor(days: number, now: Date): { from: string; to: string } {
  return { from: new Date(now.getTime() - days * 86_400_000).toISOString(), to: now.toISOString() };
}

export function heatGrid(peak: PeakCell[]): { rows: number[][]; max: number } {
  const rows = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  let max = 0;
  for (const c of peak) {
    const row = rows[c.dow - 1];
    if (!row || c.hour < 0 || c.hour > 23) continue;
    row[c.hour] = c.count;
    max = Math.max(max, c.count);
  }
  return { rows, max };
}

const manilaDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" });

/** Every Manila date in the range, with zeros where nothing happened. */
export function fillDays(daily: DayPoint[], range: { from: string; to: string }): DayPoint[] {
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const out: DayPoint[] = [];
  const last = manilaDate.format(new Date(range.to));
  for (let t = new Date(range.from).getTime(); ; t += 86_400_000) {
    const day = manilaDate.format(new Date(t));
    out.push(byDay.get(day) ?? { day, profile_view: 0, walkthrough_open: 0, directions_tap: 0 });
    if (day >= last) break;
  }
  return out;
}

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString("en-US");
}

export const share = (ratio: number | null) => (ratio === null ? "–" : `${Math.round(ratio * 100)}%`);

export const FILTER_LABEL: Record<string, string> = {
  price: "Price",
  outlets: "Power outlets",
  wifi: "Wi-Fi",
  open247: "Open 24/7",
  outdoor: "Outdoor area",
  parking: "Parking",
};

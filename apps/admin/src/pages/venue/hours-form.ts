import type { Weekday, WeeklyHours } from "@visita/shared-types";

// The hours editor works on one row per day. Stored hours (venues.hours) keep
// the distinction the public site relies on: a missing day is unknown, null
// is closed, and a close time before the open time runs past midnight.

export const DAYS: { day: Weekday; label: string }[] = [
  { day: "mon", label: "Monday" },
  { day: "tue", label: "Tuesday" },
  { day: "wed", label: "Wednesday" },
  { day: "thu", label: "Thursday" },
  { day: "fri", label: "Friday" },
  { day: "sat", label: "Saturday" },
  { day: "sun", label: "Sunday" },
];

export interface DayRow {
  day: Weekday;
  state: "unknown" | "closed" | "open";
  opens: string;
  closes: string;
  /** Derived for display: closes the next morning. */
  overnight: boolean;
}

export const isOvernight = (opens: string, closes: string) => closes < opens;

export function rowsFromHours(hours: WeeklyHours | null | undefined): DayRow[] {
  return DAYS.map(({ day }) => {
    const span = hours?.[day];
    if (hours && day in hours && span === null) return { day, state: "closed", opens: "08:00", closes: "20:00", overnight: false };
    if (span) return { day, state: "open", opens: span[0], closes: span[1], overnight: isOvernight(span[0], span[1]) };
    return { day, state: "unknown", opens: "08:00", closes: "20:00", overnight: false };
  });
}

export function hoursFromRows(rows: DayRow[]): WeeklyHours | null {
  const hours: WeeklyHours = {};
  for (const r of rows) {
    if (r.state === "closed") hours[r.day] = null;
    if (r.state === "open") hours[r.day] = [r.opens, r.closes];
  }
  return Object.keys(hours).length > 0 ? hours : null;
}

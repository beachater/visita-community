import type { Weekday, WeeklyHours } from "@visita/shared-types";

// Opening hours (venues.hours): a missing day is unknown, null is closed, and
// a close time earlier than the open time runs past midnight.

export const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/** Venues keep local time; open-now is judged there, not on the visitor's clock. */
export const VENUE_TIME_ZONE = "Asia/Manila";

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + m!;
};

/** Weekday and minutes since midnight at `date`, in the venue's time zone. */
export function venueClock(date: Date, timeZone = VENUE_TIME_ZONE): { day: Weekday; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    day: get("weekday").slice(0, 3).toLowerCase() as Weekday,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

const previousDay = (day: Weekday) => WEEKDAYS[(WEEKDAYS.indexOf(day) + 6) % 7]!;

/**
 * Whether the venue is open at `date`. Returns null when the hours can't say
 * (no hours, or today's hours unknown), so the UI shows nothing rather than
 * a guess. Handles overnight spans, including one that started yesterday.
 */
export function isOpenAt(hours: WeeklyHours | null | undefined, date: Date): boolean | null {
  if (!hours) return null;
  const { day, minutes } = venueClock(date);

  // Still inside yesterday's overnight span?
  const yesterday = hours[previousDay(day)];
  if (yesterday) {
    const [open, close] = yesterday.map(toMinutes) as [number, number];
    if (close < open && minutes < close) return true;
  }

  if (!(day in hours)) return null;
  const today = hours[day];
  if (!today) return false;
  const [open, close] = today.map(toMinutes) as [number, number];
  if (open === close) return true; // 24 hours
  return close > open ? minutes >= open && minutes < close : minutes >= open;
}

/** "08:00" → "8:00 AM", "24:00" → "12:00 AM". */
export function formatTime(hhmm: string): string {
  const total = toMinutes(hhmm) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h < 12 ? "AM" : "PM";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export interface HoursRow {
  day: Weekday;
  label: string;
  /** "8:00 AM – 9:00 PM", "Closed", or null when unknown. */
  text: string | null;
}

export function weeklyRows(hours: WeeklyHours): HoursRow[] {
  return WEEKDAYS.map((day) => {
    if (!(day in hours)) return { day, label: WEEKDAY_LABEL[day], text: null };
    const span = hours[day];
    if (!span) return { day, label: WEEKDAY_LABEL[day], text: "Closed" };
    const [open, close] = span;
    const text = open === close ? "Open 24 hours" : `${formatTime(open)} – ${formatTime(close)}`;
    return { day, label: WEEKDAY_LABEL[day], text };
  });
}

/** Open around the clock every day of the week (the "Open 24/7" filter). */
export function isOpen247(hours: WeeklyHours | null | undefined): boolean {
  return !!hours && WEEKDAYS.every((d) => {
    const span = hours[d];
    return !!span && span[0] === span[1];
  });
}

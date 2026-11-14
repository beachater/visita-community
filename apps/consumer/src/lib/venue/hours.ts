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

/**
 * "08:00" → "8:00 AM", "24:00" → "12:00 AM". `compact` drops ":00" on the
 * hour ("10 AM"), as the details panel shows it.
 */
export function formatTime(hhmm: string, compact = false): string {
  const total = toMinutes(hhmm) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h < 12 ? "AM" : "PM";
  const minutes = compact && m === 0 ? "" : `:${String(m).padStart(2, "0")}`;
  return `${h % 12 === 0 ? 12 : h % 12}${minutes} ${suffix}`;
}

const isAllDay = ([open, close]: [string, string]) => {
  const o = toMinutes(open);
  const c = toMinutes(close);
  return o === c || (o === 0 && c === 24 * 60);
};

const spanText = (span: [string, string], compact: boolean) =>
  isAllDay(span) ? "Open 24 hours" : `${formatTime(span[0], compact)} – ${formatTime(span[1], compact)}`;

export interface HoursRow {
  day: Weekday;
  label: string;
  /** "8:00 AM – 9:00 PM", "Closed", or null when unknown. */
  text: string | null;
}

export function weeklyRows(hours: WeeklyHours, compact = false): HoursRow[] {
  return WEEKDAYS.map((day) => {
    if (!(day in hours)) return { day, label: WEEKDAY_LABEL[day], text: null };
    const span = hours[day];
    if (!span) return { day, label: WEEKDAY_LABEL[day], text: "Closed" };
    return { day, label: WEEKDAY_LABEL[day], text: spanText(span, compact) };
  });
}

export interface TodaySummary {
  /** Same as isOpenAt: null when the hours can't say. */
  open: boolean | null;
  /** Today's span when open ("10 AM – 10 PM", "Open 24 hours"), else null. */
  hours: string | null;
  /** "closes in 3 h", "Closed · opens 10 AM", "Hours not listed yet"… */
  note: string;
}

const inTime = (minutes: number) => (minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h`);

/**
 * The one line under a cafe's name: today's hours and when that changes.
 * Never guesses: unknown days end the search for the next opening.
 */
export function todaySummary(hours: WeeklyHours | null | undefined, date: Date): TodaySummary {
  if (!hours || Object.keys(hours).length === 0) return { open: null, hours: null, note: "Hours not listed yet" };
  const open = isOpenAt(hours, date);
  const { day, minutes } = venueClock(date);
  const today = hours[day];

  if (open) {
    const yesterday = hours[previousDay(day)];
    // Still in last night's span: show that span, closing this morning.
    if (yesterday && !isAllDay(yesterday)) {
      const [o, c] = yesterday.map(toMinutes) as [number, number];
      if (c < o && minutes < c) return { open, hours: spanText(yesterday, true), note: `closes in ${inTime(c - minutes)}` };
    }
    if (!today || isAllDay(today)) return { open, hours: "Open 24 hours", note: "" };
    const [o, c] = today.map(toMinutes) as [number, number];
    const left = c > o ? c - minutes : c + 24 * 60 - minutes;
    return { open, hours: spanText(today, true), note: `closes in ${inTime(left)}` };
  }

  if (open === null) return { open, hours: null, note: "Today's hours not listed yet" };

  // Closed: later today, or the next known day that opens.
  if (today && toMinutes(today[0]) > minutes) return { open, hours: null, note: `Closed · opens ${formatTime(today[0], true)}` };
  const start = WEEKDAYS.indexOf(day);
  for (let i = 1; i < 7; i++) {
    const next = WEEKDAYS[(start + i) % 7]!;
    if (!(next in hours)) break;
    const span = hours[next];
    if (!span) continue;
    const when = i === 1 ? "tomorrow" : WEEKDAY_LABEL[next].slice(0, 3);
    return { open, hours: null, note: `Closed · opens ${when} ${formatTime(span[0], true)}` };
  }
  return { open, hours: null, note: "Closed" };
}

/** Open around the clock every day of the week (the "Open 24/7" filter). */
export function isOpen247(hours: WeeklyHours | null | undefined): boolean {
  return !!hours && WEEKDAYS.every((d) => {
    const span = hours[d];
    return !!span && span[0] === span[1];
  });
}

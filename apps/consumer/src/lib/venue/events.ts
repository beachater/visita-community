// Venue events and promotions (PRD 4.4) as the public sees them: current and
// upcoming only, in Manila time.

export interface VenueEvent {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  photo_url: string | null;
}

const TZ = "Asia/Manila";
const day = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: TZ });
const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ });
const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });

/** "Fri, Oct 2 · 6:00 PM – 9:00 PM"; a night that runs past midnight stays on one date. */
export function eventRange(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  const sameNight = dateKey.format(s) === dateKey.format(e) || e.getTime() - s.getTime() < 12 * 3_600_000;
  if (sameNight) return `${day.format(s)} · ${time.format(s)} – ${time.format(e)}`;
  return `${day.format(s)}, ${time.format(s)} – ${day.format(e)}, ${time.format(e)}`;
}

/** PostgREST path for a venue's current and upcoming events, soonest first. */
export function upcomingEventsPath(venueId: string, now: Date, limit = 5): string {
  const q = new URLSearchParams({
    select: "id,title,description,starts_at,ends_at,photo_url",
    venue_id: `eq.${venueId}`,
    ends_at: `gt.${now.toISOString()}`,
    order: "starts_at.asc",
    limit: String(limit),
  });
  return `venue_events?${q}`;
}

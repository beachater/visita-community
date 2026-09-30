import { FILTER_NAMES } from "../discovery/filters";

// Validation for POST /api/track (PRD 4.4 analytics). Pure, so it's tested
// without a Worker. The client sends only with the visitor's consent and
// marks the batch with consent: "usage" (sendBeacon can't set headers); the
// server refuses anything without it, so a stale client can't record by
// mistake.

export const EVENT_TYPES = ["profile_view", "walkthrough_open", "directions_tap", "search_appearance", "filter_click", "demand_tap"] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const MAX_EVENTS = 50;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION = /^[A-Za-z0-9_-]{16,64}$/;
/** Events that record which filters were on. */
const WITH_FILTERS = new Set<EventType>(["profile_view", "walkthrough_open", "filter_click"]);

export interface TrackEvent {
  type: EventType;
  venueId: string;
  props: { filters?: string[] };
}

export type TrackBody = { ok: true; sessionId: string; events: TrackEvent[] } | { ok: false; status: 400 | 403 | 413; error: string };

export function parseTrackBody(body: unknown): TrackBody {
  if (!body || typeof body !== "object") return { ok: false, status: 400, error: "Expected a JSON body." };
  const { consent, sessionId, events } = body as Record<string, unknown>;
  if (consent !== "usage") return { ok: false, status: 403, error: "No consent for usage statistics." };
  if (typeof sessionId !== "string" || !SESSION.test(sessionId)) return { ok: false, status: 400, error: "Bad session." };
  if (!Array.isArray(events) || events.length === 0) return { ok: false, status: 400, error: "No events." };
  if (events.length > MAX_EVENTS) return { ok: false, status: 413, error: "Too many events." };

  const out: TrackEvent[] = [];
  for (const e of events) {
    if (!e || typeof e !== "object") return { ok: false, status: 400, error: "Bad event." };
    const { type, venueId, props } = e as Record<string, unknown>;
    if (typeof type !== "string" || !(EVENT_TYPES as readonly string[]).includes(type)) return { ok: false, status: 400, error: "Unknown event type." };
    if (typeof venueId !== "string" || !UUID.test(venueId)) return { ok: false, status: 400, error: "Bad venue." };
    const clean: TrackEvent["props"] = {};
    const raw = (props as { filters?: unknown } | undefined)?.filters;
    if (WITH_FILTERS.has(type as EventType) && Array.isArray(raw)) {
      const names = [...new Set(raw.filter((f): f is string => typeof f === "string" && (FILTER_NAMES as readonly string[]).includes(f)))];
      if (names.length) clean.filters = names;
    }
    out.push({ type: type as EventType, venueId, props: clean });
  }
  return { ok: true, sessionId, events: out };
}

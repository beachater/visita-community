import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { adminRest, ServiceUnavailable } from "../../lib/server/admin-rest";
import { dedupeEvents, parseTrackBody } from "../../lib/server/track";

// POST /api/track: consented usage statistics (PRD 4.4). Rate-limited per
// IP and per IP and venue; one event per venue and type per batch, and the
// database keeps one per session, venue and type per hour, so a script
// can't inflate an owner's numbers. Only published venues count; the
// server's clock stamps events. Answers without detail; nobody waits on it.
export const prerender = false;

const done = (status: number) => new Response(null, { status, headers: { "cache-control": "no-store" } });

export const POST: APIRoute = async ({ request }) => {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const { success } = await env.TRACK_LIMITER.limit({ key: ip });
  if (!success) return done(429);

  const parsed = parseTrackBody(await request.json().catch(() => null));
  if (!parsed.ok) return done(parsed.status);

  try {
    const events = dedupeEvents(parsed.events, 10);
    const venues = [...new Set(events.map((e) => e.venueId))];
    const allowed = new Set<string>();
    for (const id of venues) if ((await env.TRACK_VENUE_LIMITER.limit({ key: `${ip}:${id}` })).success) allowed.add(id);
    const ids = [...allowed];
    if (ids.length === 0) return done(429);
    const lookup = await adminRest(`venues?id=in.(${ids.join(",")})&is_published=eq.true&select=id`);
    const known = new Set(((await lookup.json()) as { id: string }[]).map((v) => v.id));
    const rows = events
      .filter((e) => known.has(e.venueId))
      .map((e) => ({ venue_id: e.venueId, type: e.type, session_id: parsed.sessionId, props: e.props }));
    if (rows.length === 0) return done(204);
    const insert = await adminRest("analytics_events?on_conflict=venue_id,type,session_id,occurred_hour", {
      method: "POST",
      headers: { prefer: "return=minimal,resolution=ignore-duplicates" },
      body: JSON.stringify(rows),
    });
    return done(insert.ok ? 204 : 502);
  } catch (err) {
    if (err instanceof ServiceUnavailable) return done(503);
    throw err;
  }
};

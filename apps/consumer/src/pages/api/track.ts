import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { adminRest, ServiceUnavailable } from "../../lib/server/admin-rest";
import { parseTrackBody } from "../../lib/server/track";

// POST /api/track: consented usage statistics (PRD 4.4). Rate-limited per
// IP; only events for published venues are kept; the server's clock stamps
// them. Always answers without detail, since nobody waits on it.
export const prerender = false;

const done = (status: number) => new Response(null, { status, headers: { "cache-control": "no-store" } });

export const POST: APIRoute = async ({ request }) => {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const { success } = await env.TRACK_LIMITER.limit({ key: ip });
  if (!success) return done(429);

  const parsed = parseTrackBody(await request.json().catch(() => null));
  if (!parsed.ok) return done(parsed.status);

  try {
    const ids = [...new Set(parsed.events.map((e) => e.venueId))];
    const lookup = await adminRest(`venues?id=in.(${ids.join(",")})&is_published=eq.true&select=id`);
    const known = new Set(((await lookup.json()) as { id: string }[]).map((v) => v.id));
    const rows = parsed.events
      .filter((e) => known.has(e.venueId))
      .map((e) => ({ venue_id: e.venueId, type: e.type, session_id: parsed.sessionId, props: e.props }));
    if (rows.length === 0) return done(204);
    const insert = await adminRest("analytics_events", { method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify(rows) });
    return done(insert.ok ? 204 : 502);
  } catch (err) {
    if (err instanceof ServiceUnavailable) return done(503);
    throw err;
  }
};

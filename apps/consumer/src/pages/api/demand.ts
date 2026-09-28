import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { adminRest, ServiceUnavailable } from "../../lib/server/admin-rest";
import { parseDemandBody } from "../../lib/server/demand";

// POST /api/demand: "I want to see inside" (PRD 4.1). One request per device
// per venue (enforced by a unique index), rate-limited per IP.
export const prerender = false;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ request, locals }) => {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const { success } = await env.DEMAND_LIMITER.limit({ key: ip });
  if (!success) return json(429, { error: "Too many requests. Try again in a minute." });

  const parsed = parseDemandBody(await request.json().catch(() => null));
  if (!parsed.ok) return json(400, { error: parsed.error });

  try {
    const lookup = await adminRest(`venues?slug=eq.${encodeURIComponent(parsed.slug)}&is_published=eq.true&select=id,splat_url`);
    const [venue] = (await lookup.json()) as { id: string; splat_url: string | null }[];
    if (!venue) return json(404, { error: "Unknown cafe." });
    if (venue.splat_url) return json(409, { error: "This cafe is already scanned." });

    const insert = await adminRest("demand_requests", {
      method: "POST",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({ venue_id: venue.id, device_id: parsed.deviceId, profile_id: locals.user?.id ?? null }),
    });
    if (insert.ok) return json(200, { recorded: true, alreadyRecorded: false });
    // 409 = the unique index: this device already asked for this cafe.
    if (insert.status === 409) return json(200, { recorded: true, alreadyRecorded: true });
    return json(502, { error: "Couldn't save your request. Try again later." });
  } catch (err) {
    if (err instanceof ServiceUnavailable) return json(503, { error: "Requests aren't available yet." });
    throw err;
  }
};

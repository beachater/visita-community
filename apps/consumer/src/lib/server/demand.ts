// Validation for POST /api/demand ("I want to see inside"). Pure, so it's
// tested without a Worker.

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DEVICE = /^[A-Za-z0-9_-]{16,64}$/;

export type DemandBody = { ok: true; slug: string; deviceId: string } | { ok: false; error: string };

export function parseDemandBody(body: unknown): DemandBody {
  if (!body || typeof body !== "object") return { ok: false, error: "Expected a JSON body." };
  const { slug, deviceId } = body as Record<string, unknown>;
  if (typeof slug !== "string" || slug.length > 120 || !SLUG.test(slug)) return { ok: false, error: "Unknown cafe." };
  if (typeof deviceId !== "string" || !DEVICE.test(deviceId)) return { ok: false, error: "Missing device id." };
  return { ok: true, slug, deviceId };
}

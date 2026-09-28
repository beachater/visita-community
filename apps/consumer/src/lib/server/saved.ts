// Validation for POST /api/saved. One slug to save, or a device list to merge
// at sign-in. Pure, so it's tested without a Worker.

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_SLUGS = 200;

export type SavedBody = { ok: true; slugs: string[] } | { ok: false; error: string };

const isSlug = (s: unknown): s is string => typeof s === "string" && s.length <= 120 && SLUG.test(s);

export function parseSavedBody(body: unknown): SavedBody {
  if (!body || typeof body !== "object") return { ok: false, error: "Expected a JSON body." };
  const { slug, slugs } = body as Record<string, unknown>;
  if (slug !== undefined) return isSlug(slug) ? { ok: true, slugs: [slug] } : { ok: false, error: "Unknown cafe." };
  if (!Array.isArray(slugs) || slugs.length === 0 || slugs.length > MAX_SLUGS || !slugs.every(isSlug))
    return { ok: false, error: "Expected a list of cafes." };
  return { ok: true, slugs: [...new Set(slugs)] };
}

/**
 * Account writes only accept JSON. A cross-site page can't send JSON without
 * a CORS preflight (which this API never approves), so this backs up the
 * SameSite=Lax session cookie against forged "simple" requests.
 */
export function isJsonRequest(request: Request): boolean {
  return (request.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase() === "application/json";
}

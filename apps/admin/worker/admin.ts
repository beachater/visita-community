import { isScanKey, nextVersion, scanKey, type ScanKind } from "../src/lib/scan-keys";

// Admin-only Worker routes (PRD 4.5): scan uploads and moderators removing a
// review photo. Every request is checked with is_admin() as the caller; the
// database stays the authority for what admins may change.
//
// Scans go to R2 as multipart uploads through the Worker's binding (no R2 API
// keys needed, no size ceiling): start → part × n → complete. Keys are issued
// here, always a new version, never an existing file.

export interface AdminEnv {
  ASSETS_BUCKET: R2Bucket;
}

type Rest = (path: string, init?: RequestInit) => Promise<Response>;
type Json = (status: number, body: unknown) => Response;

export async function isAdmin(sb: Rest): Promise<boolean> {
  const res = await sb("/rest/v1/rpc/is_admin", { method: "POST", body: "{}" });
  return res.ok && (await res.json()) === true;
}

async function venueSlug(sb: Rest, venueId: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(venueId)) return null;
  const res = await sb(`/rest/v1/venues?id=eq.${venueId}&select=slug`);
  const [row] = res.ok ? ((await res.json()) as { slug: string }[]) : [];
  return row?.slug ?? null;
}

async function listKeys(bucket: R2Bucket, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, cursor });
    keys.push(...page.objects.map((o) => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return keys;
}

export async function scanRoute(request: Request, env: AdminEnv, sb: Rest, json: Json, path: string): Promise<Response> {
  if (!(await isAdmin(sb))) return json(403, { error: "Only admins can upload scans." });
  const url = new URL(request.url);

  if (path === "/api/scans/start" && request.method === "POST") {
    const body = (await request.json().catch(() => null)) as { venueId?: string; kind?: ScanKind; version?: number } | null;
    const kind = body?.kind === "preview" ? "preview" : body?.kind === "full" ? "full" : null;
    if (!body?.venueId || !kind) return json(400, { error: "Say which venue and whether this is the full scan or its preview." });
    const slug = await venueSlug(sb, body.venueId);
    if (!slug) return json(404, { error: "Venue not found." });

    const existing = await listKeys(env.ASSETS_BUCKET, `splats/${slug}/`);
    // A preview joins the version its full scan was given; a full scan always starts a new one.
    const version = kind === "full" ? nextVersion(existing, slug) : Number(body.version);
    if (!Number.isInteger(version) || version < 1) return json(400, { error: "A preview needs the version of its full scan." });
    const key = scanKey(slug, version, kind);
    if (existing.includes(key)) return json(409, { error: `${key} already exists; scans are never overwritten.` });

    const upload = await env.ASSETS_BUCKET.createMultipartUpload(key, {
      httpMetadata: { contentType: "application/octet-stream", cacheControl: "public, max-age=31536000, immutable" },
    });
    return json(201, { key, version, uploadId: upload.uploadId });
  }

  const key = url.searchParams.get("key") ?? "";
  const uploadId = url.searchParams.get("uploadId") ?? "";
  if (!isScanKey(key) || !uploadId) return json(400, { error: "Missing upload." });
  const upload = env.ASSETS_BUCKET.resumeMultipartUpload(key, uploadId);

  if (path === "/api/scans/part" && request.method === "PUT") {
    const part = Number(url.searchParams.get("part"));
    if (!Number.isInteger(part) || part < 1 || part > 10_000 || !request.body) return json(400, { error: "Bad part." });
    const uploaded = await upload.uploadPart(part, request.body);
    return json(200, { partNumber: uploaded.partNumber, etag: uploaded.etag });
  }
  if (path === "/api/scans/complete" && request.method === "POST") {
    const body = (await request.json().catch(() => null)) as { parts?: R2UploadedPart[] } | null;
    if (!Array.isArray(body?.parts) || body.parts.length === 0) return json(400, { error: "No parts." });
    const object = await upload.complete(body.parts);
    return json(200, { key: object.key, size: object.size });
  }
  if (path === "/api/scans/abort" && request.method === "POST") {
    await upload.abort();
    return json(200, { aborted: true });
  }
  return json(405, { error: "Method not allowed." });
}

/** Moderators remove a review photo: the file (public by key) and the reference. */
export async function removeReviewPhoto(env: AdminEnv, sb: Rest, json: Json, reviewId: string): Promise<Response> {
  if (!(await isAdmin(sb))) return json(403, { error: "Only admins can remove review photos." });
  const res = await sb(`/rest/v1/reviews?id=eq.${reviewId}&select=id,photo_url`);
  const [review] = res.ok ? ((await res.json()) as { id: string; photo_url: string | null }[]) : [];
  if (!review) return json(404, { error: "Review not found." });
  if (!review.photo_url) return json(200, { removed: false });
  const patch = await sb(`/rest/v1/reviews?id=eq.${reviewId}`, {
    method: "PATCH",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ photo_url: null }),
  });
  if (!patch.ok) return json(502, { error: "Couldn't update the review." });
  await env.ASSETS_BUCKET.delete(review.photo_url);
  return json(200, { removed: true });
}



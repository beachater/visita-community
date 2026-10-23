import { checkPhoto, eventPhotoKey, MAX_PHOTO_BYTES, ownerProofKey, type PhotoType } from "@visita/uploads/photo";
import { bearerToken, eventPhotoId, proofClaimId, reviewPhotoId, SCAN_ROUTES } from "../src/lib/proof-route";
import { MENU_SCAN_PROMPT, MENU_SCAN_SCHEMA, menuScanVenueId, rowsFromScan } from "../src/lib/menu-scan";
import { removeReviewPhoto, scanRoute } from "./admin";

// The owner and admin app's Worker. It serves the SPA's static files, plus
// photo uploads that need the server to check who's uploading and what:
//   POST   /api/claims/<id>/proof  the claimant uploads proof for their own pending claim (private)
//   GET    /api/claims/<id>/proof  the claimant or an admin views it
//   POST   /api/events/<id>/photo  a venue owner adds or replaces an event photo (public)
//   DELETE /api/events/<id>/photo  and removes it
//   /api/scans/*                   admins upload scans (see admin.ts)
//   DELETE /api/reviews/<id>/photo moderators remove a review photo
//   POST   /api/venues/<id>/menu-scan  an owner sends a menu photo; Workers AI reads it (nothing stored)
// Every Supabase call runs as the caller (their access token), so RLS decides
// what they can read and write. No service key lives here.

interface Env {
  AI: Ai;
  ASSETS: Fetcher;
  ASSETS_BUCKET: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
}

interface Claim {
  id: string;
  profile_id: string;
  status: "pending" | "approved" | "rejected";
  proof_key: string | null;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

function supabase(env: Env, token: string) {
  const base = env.SUPABASE_URL.replace(/\/+$/, "");
  return (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set("apikey", env.SUPABASE_PUBLISHABLE_KEY);
    headers.set("authorization", `Bearer ${token}`);
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    return fetch(`${base}${path}`, { ...init, headers });
  };
}

async function caller(env: Env, token: string, claimId: string) {
  const sb = supabase(env, token);
  const [userRes, claimRes] = await Promise.all([
    sb("/auth/v1/user"),
    sb(`/rest/v1/venue_owners?id=eq.${claimId}&select=id,profile_id,status,proof_key`),
  ]);
  if (!userRes.ok) return null;
  const user = (await userRes.json()) as { id: string };
  const claims = claimRes.ok ? ((await claimRes.json()) as Claim[]) : [];
  return { sb, userId: user.id, claim: claims[0] ?? null };
}

async function uploadProof(request: Request, env: Env, token: string, claimId: string): Promise<Response> {
  if (!(request.headers.get("content-type") ?? "").startsWith("image/")) return json(415, { error: "Send the proof as a photo." });
  if (Number(request.headers.get("content-length") ?? "0") > MAX_PHOTO_BYTES) return json(413, { error: "Photos can be up to 8 MB." });

  const who = await caller(env, token, claimId);
  if (!who) return json(401, { error: "Sign in again to upload proof." });
  if (!who.claim || who.claim.profile_id !== who.userId) return json(404, { error: "That claim isn't yours." });
  if (who.claim.status !== "pending") return json(409, { error: "This claim has been reviewed; its proof can't change." });

  const bytes = new Uint8Array(await request.arrayBuffer());
  const check = checkPhoto(bytes.subarray(0, 16), bytes.byteLength);
  if (!check.ok) return json(check.status, { error: check.error });

  const key = ownerProofKey(claimId, crypto.randomUUID(), check.type);
  await env.ASSETS_BUCKET.put(key, bytes, { httpMetadata: { contentType: check.type } });
  const patch = await who.sb(`/rest/v1/venue_owners?id=eq.${claimId}`, {
    method: "PATCH",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ proof_key: key }),
  });
  if (!patch.ok) {
    await env.ASSETS_BUCKET.delete(key);
    return json(502, { error: "Couldn't attach the proof. Try again." });
  }
  // Keys are pinned to their folder in the database too; checked again before deleting.
  if (who.claim.proof_key?.startsWith(`owner-proofs/${claimId}/`)) await env.ASSETS_BUCKET.delete(who.claim.proof_key);
  return json(201, { uploaded: true });
}

async function viewProof(env: Env, token: string, claimId: string): Promise<Response> {
  const who = await caller(env, token, claimId);
  if (!who) return json(401, { error: "Sign in again." });
  if (!who.claim) return json(404, { error: "Claim not found." });
  if (who.claim.profile_id !== who.userId) {
    // Co-owners can read a venue's owner list, but only admins see someone else's proof.
    const admin = await who.sb("/rest/v1/rpc/is_admin", { method: "POST", body: "{}" });
    if (!admin.ok || (await admin.json()) !== true) return json(404, { error: "Claim not found." });
  }
  if (!who.claim.proof_key) return json(404, { error: "No proof uploaded yet." });
  const object = await env.ASSETS_BUCKET.get(who.claim.proof_key);
  if (!object) return json(404, { error: "No proof uploaded yet." });
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

type PhotoUpload = { ok: false; response: Response } | { ok: true; bytes: Uint8Array; type: PhotoType };

async function readPhoto(request: Request): Promise<PhotoUpload> {
  if (!(request.headers.get("content-type") ?? "").startsWith("image/")) return { ok: false, response: json(415, { error: "Send a photo." }) };
  if (Number(request.headers.get("content-length") ?? "0") > MAX_PHOTO_BYTES) return { ok: false, response: json(413, { error: "Photos can be up to 8 MB." }) };
  const bytes = new Uint8Array(await request.arrayBuffer());
  const check = checkPhoto(bytes.subarray(0, 16), bytes.byteLength);
  if (!check.ok) return { ok: false, response: json(check.status, { error: check.error }) };
  return { ok: true, bytes, type: check.type };
}

async function eventPhoto(request: Request, env: Env, token: string, eventId: string): Promise<Response> {
  const sb = supabase(env, token);
  const res = await sb(`/rest/v1/venue_events?id=eq.${eventId}&select=id,venue_id,photo_url`);
  const [event] = res.ok ? ((await res.json()) as { id: string; venue_id: string; photo_url: string | null }[]) : [];
  if (!event) return json(404, { error: "Event not found." });
  const owner = await sb("/rest/v1/rpc/is_venue_owner", { method: "POST", body: JSON.stringify({ p_venue_id: event.venue_id }) });
  if (!owner.ok || (await owner.json()) !== true) return json(404, { error: "Event not found." });

  let key: string | null = null;
  if (request.method === "POST") {
    const photo = await readPhoto(request);
    if (!photo.ok) return photo.response;
    key = eventPhotoKey(event.id, crypto.randomUUID(), photo.type);
    await env.ASSETS_BUCKET.put(key, photo.bytes, {
      httpMetadata: { contentType: photo.type, cacheControl: "public, max-age=31536000, immutable" },
    });
  }
  const patch = await sb(`/rest/v1/venue_events?id=eq.${event.id}`, {
    method: "PATCH",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ photo_url: key }),
  });
  if (!patch.ok) {
    if (key) await env.ASSETS_BUCKET.delete(key);
    return json(502, { error: "Couldn't save the photo. Try again." });
  }
  if (event.photo_url?.startsWith(`events/${event.id}/`)) await env.ASSETS_BUCKET.delete(event.photo_url);
  return json(request.method === "POST" ? 201 : 200, { photoUrl: key });
}

const MENU_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

function dataUri(bytes: Uint8Array, type: string) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(binary)}`;
}

// The photo goes to the model and is then dropped. The owner reviews the
// items in the editor; nothing reaches the listing until they save.
async function menuScan(request: Request, env: Env, token: string, venueId: string): Promise<Response> {
  const sb = supabase(env, token);
  const [owner, admin] = await Promise.all([
    sb("/rest/v1/rpc/is_venue_owner", { method: "POST", body: JSON.stringify({ p_venue_id: venueId }) }),
    sb("/rest/v1/rpc/is_admin", { method: "POST", body: "{}" }),
  ]);
  const allowed = (owner.ok && (await owner.json()) === true) || (admin.ok && (await admin.json()) === true);
  if (!allowed) return json(404, { error: "Venue not found." });

  const photo = await readPhoto(request);
  if (!photo.ok) return photo.response;

  let answer: unknown;
  try {
    const result = (await env.AI.run(MENU_MODEL as Parameters<Ai["run"]>[0], {
      messages: [
        { role: "system", content: "You read cafe menus from photos and answer only with JSON." },
        {
          role: "user",
          content: [
            { type: "text", text: MENU_SCAN_PROMPT },
            { type: "image_url", image_url: { url: dataUri(photo.bytes, photo.type) } },
          ],
        },
      ],
      guided_json: MENU_SCAN_SCHEMA,
      temperature: 0,
      max_tokens: 4096,
    } as never)) as { response?: unknown };
    answer = result.response;
  } catch (e) {
    console.error("[menu-scan]", e);
    return json(502, { error: "Couldn't read the photo right now. Try again in a minute." });
  }
  const rows = rowsFromScan(answer);
  if (!rows.length) return json(422, { error: "Couldn't find menu items in that photo. Try a closer, brighter shot of the menu." });
  return json(200, { rows });
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    const claimId = proofClaimId(url.pathname);
    const eventId = eventPhotoId(url.pathname);
    const reviewId = reviewPhotoId(url.pathname);
    const menuVenueId = menuScanVenueId(url.pathname);
    const scan = (SCAN_ROUTES as readonly string[]).includes(url.pathname);
    if (!claimId && !eventId && !reviewId && !menuVenueId && !scan) return json(404, { error: "Not found." });
    if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return json(503, { error: "Not configured." });
    const token = bearerToken(request.headers.get("authorization"));
    if (!token) return json(401, { error: "Sign in to continue." });

    if (menuVenueId) {
      if (request.method === "POST") return menuScan(request, env, token, menuVenueId);
      return json(405, { error: "Method not allowed." });
    }
    if (scan) return scanRoute(request, env, supabase(env, token), json, url.pathname);
    if (reviewId) {
      if (request.method === "DELETE") return removeReviewPhoto(env, supabase(env, token), json, reviewId);
      return json(405, { error: "Method not allowed." });
    }
    if (eventId) {
      if (request.method === "POST" || request.method === "DELETE") return eventPhoto(request, env, token, eventId);
      return json(405, { error: "Method not allowed." });
    }
    if (!claimId) return json(404, { error: "Not found." });

    if (request.method === "POST") return uploadProof(request, env, token, claimId);
    if (request.method === "GET") return viewProof(env, token, claimId);
    return json(405, { error: "Method not allowed." });
  },
} satisfies ExportedHandler<Env>;

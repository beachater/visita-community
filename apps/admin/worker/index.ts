import { checkPhoto, MAX_PHOTO_BYTES, ownerProofKey } from "@visita/uploads/photo";
import { bearerToken, proofClaimId } from "../src/lib/proof-route";

// The owner and admin app's Worker. It serves the SPA's static files, plus
// one API: owner claim proofs (PRD 4.4), which are private.
//   POST /api/claims/<id>/proof  the claimant uploads proof for their own pending claim
//   GET  /api/claims/<id>/proof  the claimant or an admin views it
// Every Supabase call runs as the caller (their access token), so RLS decides
// what they can read and write. No service key lives here.

interface Env {
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
  if (who.claim.proof_key) await env.ASSETS_BUCKET.delete(who.claim.proof_key);
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

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    const claimId = proofClaimId(url.pathname);
    if (!claimId) return json(404, { error: "Not found." });
    if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return json(503, { error: "Not configured." });
    const token = bearerToken(request.headers.get("authorization"));
    if (!token) return json(401, { error: "Sign in to continue." });

    if (request.method === "POST") return uploadProof(request, env, token, claimId);
    if (request.method === "GET") return viewProof(env, token, claimId);
    return json(405, { error: "Method not allowed." });
  },
} satisfies ExportedHandler<Env>;
